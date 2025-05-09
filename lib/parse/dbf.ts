import {ToDataView} from "../utils/file.ts";

function dbfHeader(data: DataView) {
    return {
        lastUpdated: new Date(
            data.getUint8(1) + 1900,
            data.getUint8(2),
            data.getUint8(3),
        ),
        records: data.getUint32(4, true),
        headerLen: data.getUint16(8, true),
        recLen: data.getUint16(10, true),
    }
}

function dbfRowHeader(data: DataView, headerLen: number, decoder?: string) {
    var out = []
    var offset = 32
    while (offset < headerLen) {
        const arr = new Uint8Array(
            data.buffer.slice(
                data.byteOffset + offset,
                data.byteOffset + offset + 11,
            ),
        )
        out.push({
            name: getDecoder(arr, decoder)(arr),
            dataType: String.fromCharCode(data.getUint8(offset + 11)),
            len: data.getUint8(offset + 16),
            decimal: data.getUint8(offset + 17),
        })
        if (data.getUint8(offset + 32) === 13) {
            break
        } else {
            offset += 32
        }
    }
    return out
}

function rowFuncs(buffer: DataView, offset: number, len: number, type: string, decoder?: string) {
    const data = new Uint8Array(
        buffer.buffer.slice(
            buffer.byteOffset + offset,
            buffer.byteOffset + offset + len,
        ),
    )
    const textData = getDecoder(data, decoder)(data)
    switch (type) {
        case 'N':
        case 'F':
        case 'O':
            return parseFloat(textData)
        case 'D':
            return new Date(
                Number(textData.slice(0, 4)),
                parseInt(textData.slice(4, 6), 10) - 1,
                Number(textData.slice(6, 8)),
            )
        case 'L':
            return textData.toLowerCase() === 'y' || textData.toLowerCase() === 't'
        default:
            return textData
    }
}

function parseRow(buffer: DataView, offset: number, rowHeaders: ReturnType<typeof dbfRowHeader>, decoder?: string) {
    var out: Record<string, any> = {}
    var i = 0
    var len = rowHeaders.length
    var field
    var header
    while (i < len) {
        header = rowHeaders[i]
        field = rowFuncs(buffer, offset, header.len, header.dataType, decoder)
        offset += header.len
        if (typeof field !== 'undefined') {
            out[header.name] = field
        }
        i++
    }
    return out
}

export default async function (data: File | ArrayBuffer | DataView, encoding?: string) {
    const view = await ToDataView(data);
    const header = dbfHeader(view)
    const rowHeaders = dbfRowHeader(view, header.headerLen - 1, encoding)
    let offset = ((rowHeaders.length + 1) << 5) + 2
    const recLen = header.recLen
    let records = header.records
    const out = []
    while (records) {
        out.push(parseRow(view, offset, rowHeaders, encoding))
        offset += recLen
        records--
    }
    return out
}

let decodes = {} as Record<string, (buffer: Uint8Array) => string>

function getDecoder(data: Uint8Array, decoder?: string) {
    let encoding = decoder
    if (!encoding) {
        if (isUTF8(data)) {
            encoding = 'utf-8'
        } else {
            encoding = 'gbk'
        }
    }
    if (decodes[encoding]) {
        return decodes[encoding]
    }
    decodes[encoding] = (buffer) => {
        var decoder = new TextDecoder(encoding)
        var out =
            decoder.decode(buffer, {
                stream: true,
            }) + decoder.decode()
        return out.replace(/\0/g, '').trim()
    }
    return decodes[encoding]
}

// 判断文件编码格式的函数
function isUTF8(bytes: any) {
    var i = 0;
    while (i < bytes.length) {
        if ((// ASCII
            bytes[i] == 0x09 ||
            bytes[i] == 0x0A ||
            bytes[i] == 0x0D ||
            (0x20 <= bytes[i] && bytes[i] <= 0x7E)
        )
        ) {
            i += 1;
            continue;
        }

        if ((// non-overlong 2-byte
            (0xC2 <= bytes[i] && bytes[i] <= 0xDF) &&
            (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF)
        )
        ) {
            i += 2;
            continue;
        }

        if ((// excluding overlongs
                bytes[i] == 0xE0 &&
                (0xA0 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            ) ||
            (// straight 3-byte
                ((0xE1 <= bytes[i] && bytes[i] <= 0xEC) ||
                    bytes[i] == 0xEE ||
                    bytes[i] == 0xEF) &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            ) ||
            (// excluding surrogates
                bytes[i] == 0xED &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x9F) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            )
        ) {
            i += 3;
            continue;
        }

        if ((// planes 1-3
                bytes[i] == 0xF0 &&
                (0x90 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            ) ||
            (// planes 4-15
                (0xF1 <= bytes[i] && bytes[i] <= 0xF3) &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            ) ||
            (// plane 16
                bytes[i] == 0xF4 &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x8F) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            )
        ) {
            i += 4;
            continue;
        }
        return false;
    }
    return true;
}
