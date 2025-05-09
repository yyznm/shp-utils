import {Feature, FeatureCollection, GeoJsonGeometry, Position} from "../type";

export function enlarge(extent: ExtentType, pt: Position) {
    if (pt[0] < extent.xmin) extent.xmin = pt[0]
    if (pt[0] > extent.xmax) extent.xmax = pt[0]
    if (pt[1] < extent.ymin) extent.ymin = pt[1]
    if (pt[1] > extent.ymax) extent.ymax = pt[1]
    if(typeof pt[2] !== 'undefined'){
        if (pt[2] < extent.zmin) extent.zmin = pt[2]
        if (pt[2] > extent.zmax) extent.zmax = pt[2]
    }
    return extent
}

export function enlargeExtent(extent: ExtentType, ext: ExtentType) {
    if (ext.xmax > extent.xmax) extent.xmax = ext.xmax
    if (ext.xmin < extent.xmin) extent.xmin = ext.xmin
    if (ext.ymax > extent.ymax) extent.ymax = ext.ymax
    if (ext.ymin < extent.ymin) extent.ymin = ext.ymin
    return extent
}

type ExtentType = {
    xmin: number,
    ymin: number,
    xmax: number,
    ymax: number,
    zmin: number,
    zmax: number,
}

export function blank(): ExtentType {
    return {
        xmin: Number.MAX_VALUE,
        ymin: Number.MAX_VALUE,
        xmax: -Number.MAX_VALUE,
        ymax: -Number.MAX_VALUE,
        zmin: Number.MAX_VALUE,
        zmax: -Number.MAX_VALUE,
    }
}

export function extentGeojosn(geojosn: FeatureCollection): ExtentType {
    return extentFeatures(geojosn.features)
}
export function extentFeature(feature: Feature): ExtentType {
    return justCoords(feature.geometry.coordinates)
}

export function extentFeatures(features: Feature[]): ExtentType {
    return features.reduce(function (extent, c) {
        return justCoords(c.geometry.coordinates, extent)
    }, blank())
}

function justCoords(coords: GeoJsonGeometry["coordinates"], ext: ExtentType = blank()): ExtentType {
    if (!coords || coords.length === 0) {
        return ext
    }
    if (Array.isArray(coords[0])) { // 还有下一层
        return coords.reduce(function (extent, c) {
            return justCoords(c as Position, extent)
        }, ext)
    }
    return enlarge(ext, coords as Position)
}
