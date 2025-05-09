export function FileToDataView(file: File): Promise<DataView> {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.onload = function (event) {
            if (!event.target) return reject(new Error('File could not be read!'))
            const arrayBuffer = event.target.result // 获取 ArrayBuffer
            if (!arrayBuffer) return reject(new Error('File could not be read!'))
            const dataView = new DataView(arrayBuffer as ArrayBuffer) // 将 ArrayBuffer 转为 DataView
            resolve(dataView)
        }
        reader.onerror = function (event) {
            reject(
                new Error('File could not be read! Code ' + event.target?.error?.code),
            )
        }
        reader.readAsArrayBuffer(file)
    })
}

export function FileToString(file: File): Promise<string> {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.onload = function (event) {
            if (!event.target) return reject(new Error('File could not be read!'))
            const text = event.target.result // 获取文本
            if (text === null) return reject(new Error('File could not be read!'))
            resolve(text as string)
        }
        reader.onerror = function (event) {
            reject(
                new Error('File could not be read! Code ' + event.target?.error?.code),
            )
        }
        reader.readAsText(file)
    })
}

export function ToDataView(data: ArrayBuffer | File | DataView): Promise<DataView> {
    // 如果已经是 DataView，直接返回
    if (data instanceof DataView) {
        return Promise.resolve(data);
    }

    // 如果是 File，使用已有的 FileToDataView 方法
    if (data instanceof File) {
        return FileToDataView(data);
    }

    // 如果是 ArrayBuffer，创建新的 DataView
    if (data instanceof ArrayBuffer) {
        return Promise.resolve(new DataView(data));
    }

    throw new Error('Unsupported data type');
}

export function DataViewToFile(dataView: DataView, fileName: string, fileType?: string) {
    // 创建 Blob 对象
    const blob = new Blob([dataView], { type: fileType })
    // 创建 File 对象
    return new File([blob], fileName, { type: fileType })
}

export function StringToFile(str: string, fileName: string, fileType = 'text/plain') {
    return new File([str], fileName, {
        type: fileType,
    })
}

export function StringToDataView(str: string) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    return new DataView(data.buffer)
}
