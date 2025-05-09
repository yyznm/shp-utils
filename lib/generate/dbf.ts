import {isShpType, shpType} from "../utils";
import {Feature, FeatureCollection} from "../type.ts";
import {StringToDataView} from "../utils/file.ts";

type OptionType = {
    encoding?: string;
};

export default function (data: FeatureCollection, option?: OptionType) {
    return new DbfFile(data, option || {}).files;
}

class DbfFile {
    private geojson: FeatureCollection;
    // @ts-ignore
    private option: OptionType;
    files: {
        dbf: DataView<ArrayBuffer>;
        cpg: DataView<ArrayBuffer>;
    }[];

    constructor(data: FeatureCollection, option: OptionType) {
        this.geojson = data;
        this.option = option;
        // 多种类型的feature，分开写
        this.files = shpType
            .map((type) => this.geojson.features.filter(isShpType(type)))
            .filter((features) => features.length > 0)
            .map((features) => {
                const {dbf, cpg} = new DbfFileGenerate(features);
                return {dbf, cpg};
            });
    }
}

export class DbfFileGenerate {
    dbf: DataView<ArrayBuffer>;
    cpg: DataView<ArrayBuffer>;

    constructor(features: Feature[]) {
        this.cpg = StringToDataView('UTF-8')
        const field_meta = multi(features);
        // 字段长度
        const fieldDescLength = 32 * field_meta.length + 1;
        // 每条记录的字节数
        const bytesPerRecord = field_meta.reduce((num, field) => num + field.size, 1);
        // 字段头 + 头部  + 内容 + 结束标记
        const dbfLenght = fieldDescLength + 32 + bytesPerRecord * features.length + 1
        this.dbf = new DataView(new ArrayBuffer(dbfLenght));
        // 版本号
        this.dbf.setUint8(0, 0x03);
        // 时间
        const now = new Date();
        this.dbf.setUint8(1, now.getFullYear() - 1900);
        this.dbf.setUint8(2, now.getMonth() + 1);
        this.dbf.setUint8(3, now.getDate());
        // 数量
        this.dbf.setUint32(4, features.length, true);
        // 头部长度
        var headerLength = fieldDescLength + 32;
        this.dbf.setUint16(8, headerLength, true);
        // 每条记录的长度
        this.dbf.setUint16(10, bytesPerRecord, true);

        //
        this.dbf.setInt8(32 + fieldDescLength - 1, 0x0D);

        field_meta.forEach((field, i) => {
            // 字段名称
            field.name.split('').slice(0, 10).forEach((c, x) => {
                this.dbf.setInt8(32 + i * 32 + x, c.charCodeAt(0));
            });
            // 字段类型
            this.dbf.setInt8(32 + i * 32 + 11, field.type.charCodeAt(0));
            // 字段长度
            this.dbf.setInt8(32 + i * 32 + 16, field.size);
            if (field.type == 'N') this.dbf.setInt8(32 + i * 32 + 17, 3);
        });

        let offset = fieldDescLength + 32;
        const encoder = new TextEncoder();
        features.forEach(({properties: row}) => {
            // 删除标志：不删除
            this.dbf.setUint8(offset, 32);
            offset++;
            field_meta.forEach((field) => {
                let val = row[field.name];
                if (val === null || typeof val === 'undefined') val = '';
                switch (field.type) {
                    // boolean
                    case 'L':
                        this.dbf.setUint8(offset, val ? 84 : 70);
                        offset++;
                        break;
                    // date
                    case 'D':
                        offset = writeString(this.dbf, field.size, val.toString(), offset);
                        break;
                    // number
                    case 'N':
                        offset = writeString(this.dbf, Math.max(field.size, 18), val.toString(), offset);
                        break;

                    // string
                    case 'C':
                        const uint8 = encoder.encode(val.toString())
                        for (let i = 0; i < field.size; i++) {
                            if (i >= uint8.length) {
                                this.dbf.setUint8(offset, 32); // 32 是 ASCII 空格
                            } else {
                                this.dbf.setUint8(offset, uint8[i]);
                            }
                            offset++;
                        }
                        break;

                    default:
                        throw new Error('未知的字段类型');
                }
            });
        });
        // 结束标记
        this.dbf.setUint8(offset, 0x1A);
    }

}

// 获取所有字段的长度
function multi(features: Feature[]) {
    var fields = {} as { [key: string]: any };
    features.forEach((feature) => {
        const attr = feature.properties || {};
        for (var key in attr) {
            var isDef = typeof attr[key] !== "undefined" && attr[key] !== null;
            if (typeof fields[key] === "undefined" || isDef) {
                fields[key] = attr[key];
            }
        }
    });
    return Object.keys(fields).map((key) => {
        const type = types[typeof fields[key]];
        return {
            name: key,
            type: type,
            size: fieldSize[type],
        };
    });
}

const types = {
    string: "C",
    number: "N",
    boolean: "L",
    // 如果字段的值都为null，则使用类型
    null: "C",
} as { [key: string]: "C" | "N" | "L" | "D" };

const fieldSize = {
    // string
    C: 254,
    // boolean
    L: 1,
    // date
    D: 8,
    // number
    N: 18,
    // number
    M: 18,
    // number, float
    F: 18,
    // number
    B: 8,
} as { [key: string]: number };


function writeString(view: DataView, fieldLength: number, str: string, offset: number) {
    for (let i = 0; i < fieldLength; i++) {
        if (i >= str.length) {
            view.setUint8(offset, 32); // 32 是 ASCII 空格
        } else {
            view.setUint8(offset, str.charCodeAt(i));
        }
        offset++;
    }
    return offset;
}
