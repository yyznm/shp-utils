import ParseDbfFile from "./dbf.ts";
import {FileToString} from "../utils/file.ts";
import JSZip from "jszip";
import {Feature, FeatureCollection} from "../type";
import ParseShpFile from "./shp.ts";

export async function ShapeAutoToGeoJSON(files: File[] | File | FileList, options?: {
    removeBbox?: boolean
}) {
    // FileToDataView(files[0]).then(res=>{
    //     const uint8Array = new Uint8Array(res.buffer);
    //     let binaryString = '';
    //     for (let i = 0; i < uint8Array.length; i++) {
    //         binaryString += uint8Array[i];
    //         binaryString += "\n"
    //     }
    //     console.log(binaryString)
    // })
    if(files instanceof FileList){
        files = Array.from(files)
    }
    if(!Array.isArray(files)) {
       files = [files]
    }
    if(files.length === 1){
        if (files[0].name.endsWith('.zip')) {
            // 解压
            const zip = await JSZip.loadAsync(files[0])
            let keys = Object.keys(zip.files)
            files = []
            for (let i = 0; i < keys.length; i++) {
                let file = zip.files[keys[i]]
                let arr =  await file.async('blob')
                files.push(new File([arr], file.name, { type: arr.type }))
            }
        }
    }
    const zip: Record<string, File> = {}
    const names: string[] = []
    files.forEach(file => {
      const lastDotIdx = file.name.lastIndexOf('.')
      const type = file.name.slice(lastDotIdx + 1).toLowerCase()
      const name = file.name.slice(0, lastDotIdx)
      if (type === 'shp') {
        names.push(name)
      }
      zip[`${name}.${type}`] = file
    })
    // if (names.length > 1) {
    //   throw new Error(
    //     '请保证选择的文件夹或zip中只有同一名称的shp及相关文件，暂不支持多个shp文件',
    //   )
    // }
    return Promise.all(names.map(async name => {
        // 是否有shp文件
        if (!zip[`${name}.shp`]) {
            throw new Error('请保证选择的文件夹或zip中有一个.shp文件')
        }
        let dbf: Record<string, any>[] = []
        // 是否有dbf文件
        if (zip[`${name}.dbf`]) {
            // 读取dbf文件
            dbf = await ParseDbfFile(
                zip[`${name}.dbf`],
                zip[`${name}.cpg`] && (await FileToString(zip[`${name}.cpg`])),
            )
        }
        const shp = await ParseShpFile(zip[`${name}.shp`], { removeBbox: options?.removeBbox })
        const out: FeatureCollection = {
            type: 'FeatureCollection',
            features: shp.map((feature, i) => {
                if(!feature) return null
                return {
                    type: 'Feature',
                    geometry: feature,
                    properties: dbf[i] || {},
                } as Feature
            }).filter(x=> x !== null),
        }
        return out
    }))
}

export {
    ParseDbfFile,
    ParseShpFile,
}
