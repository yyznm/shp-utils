import {Feature, GeoJsonGeometry} from "../type.ts";


export const shpType = ['Point', 'MultiPoint', 'Polyline', 'Polygon', 'ZPoint', 'ZMultiPoint', 'ZPolyline', 'ZPolygon'] as const;

export type ShpType = typeof shpType[number]

export function isShpType(type: ShpType) {
    return function (f: Feature) {
        // shp 中对于geojson的类型
        let types = {
            "Point": ["Point"],
            "MultiPoint": ["MultiPoint"],
            "Polyline": ["LineString", "MultiLineString"],
            "Polygon": ["Polygon", "MultiPolygon"]
        }[type.replace("Z", "")] || [];
        const coordIsZ = isZ(f.geometry.coordinates); // 有没有z值数据
        return types.includes(f.geometry.type) && ((type.includes("Z") && coordIsZ) || (!coordIsZ && !type.includes("Z")));
    };
}


export function isZ(coo: GeoJsonGeometry["coordinates"]) {
    if (Array.isArray(coo[0])) {
        return isZ(coo[0]);
    }
    return Array.isArray(coo) && coo.length === 3;
}
