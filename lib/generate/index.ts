// import {ShapeAutoToGeoJSON} from "../parse";
import GenerateShpFile, {ShpFileGenerate} from "./shp.ts";
import GenerateDbfFile, {DbfFileGenerate} from "./dbf.ts";

import {FeatureCollection} from "../type";
import {isShpType, ShpType, shpType} from "../utils";
import {DataViewToFile} from "../utils/file.ts";
import JSZip from "jszip";

type ReturnList<T> = T extends true ? ({
    cpg: File;
    dbf: File;
    shp: File;
    shx: File;
    type: ShpType
}[]) : ({
    cpg: DataView<ArrayBuffer>;
    dbf: DataView<ArrayBuffer>;
    shp: DataView<ArrayBuffer>;
    shx: DataView<ArrayBuffer>;
    type: ShpType
}[])

export async function GeoJSONToShape<
    T extends boolean = false,
    Z extends boolean = false,
    R = Z extends true ? File : ReturnList<T>
>(geoJSON: FeatureCollection | string, option: {
    returnFile?: T,
    returnZip?: Z,
    fileName?: string
} = {}): Promise<R> {
    if (typeof geoJSON === "string") {
        geoJSON = JSON.parse(geoJSON) as FeatureCollection
    }
    const list = shpType.map((type: ShpType) => ({
        type,
        features: geoJSON.features.filter(isShpType(type))
    }))
        .filter(({features}) => features.length > 0)
        .map(({type, features}) => {
            const {dbf, cpg} = new DbfFileGenerate(features)
            const {shp, shx} = new ShpFileGenerate(features, type as ShpType)
            if (option?.returnFile || option?.returnZip) {
                return {
                    dbf: DataViewToFile(dbf, `${type}.dbf`),
                    cpg: DataViewToFile(cpg, `${type}.cpg`),
                    shp: DataViewToFile(shp, `${type}.shp`),
                    shx: DataViewToFile(shx, `${type}.shx`),
                    type
                }
            }
            return {dbf, cpg, shp, shx, type}
        })

    if (option?.returnZip) {
        const zip = new JSZip();
        list.forEach(({type, ...file}) => {
            let name = (list.length > 1 || typeof option.fileName === "undefined") ? `${type}.` : "."
            if(typeof option.fileName !== "undefined"){
                name = option.fileName + (list.length > 1 ? "-" : "") + name
            }
            for (const key in file) {
                zip.file(name + key, (file as any)[key]);
            }
        })
        return zip.generateAsync({type: "blob"}).then((content) => {
            return new File([content], (option.fileName ?? "shape")+ ".zip" , {type: "application/zip"})  as R
        })
    }
    return list as R
}


export {
    GenerateShpFile,
    GenerateDbfFile
}
