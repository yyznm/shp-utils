import {
    Feature,
    FeatureCollection,
    LineStringGeometry,
    MultiLineStringGeometry,
    MultiPointGeometry, MultiPolygonGeometry,
    PointGeometry, PolygonGeometry, Position,
} from "../type";
import {extentFeature, extentFeatures} from "../utils/extent";
import {isShpType, ShpType, shpType} from "../utils"

export default function (data: FeatureCollection, option?: OptionType) {
    return new ShpFile(data, option || {}).files;
};

type OptionType = {}


class ShpFile {
    private geojson: FeatureCollection;
    // @ts-ignore
    private option: OptionType;
    files: {
        shp: DataView<ArrayBuffer>;
        shx: DataView<ArrayBuffer>;
    }[];

    constructor(data: FeatureCollection, option: OptionType) {
        this.geojson = data;
        this.option = option;
        // 循环所有的feature，获取类型，然后写几何数据
        // 多种类型的feature，可以分开写
        this.files = shpType.map((type) => ({type, features: this.geojson.features.filter(isShpType(type))}))
            .filter(({features}) => features.length > 0)
            .map(({type, features}) => {
                const {shp, shx} = new ShpFileGenerate(features, type)
                return {shp, shx}
            })
    }

}


export class ShpFileGenerate {
    private shpFuncObj = {
        'Point': [1, this.generatePoint],
        'Polyline': [3, this.generatePolylineAndPolygon],
        'Polygon': [5, this.generatePolylineAndPolygon],
        'MultiPoint': [8, this.generateMultiPoint],
        'ZPoint': [11, this.generatePoint],
        'ZPolyline': [13, this.generatePolylineAndPolygon],
        'ZPolygon': [15, this.generatePolylineAndPolygon],
        'ZMultiPoint': [18, this.generateMultiPoint],
    } as Record<ShpType, ([number, ((features: Feature[]) => void)])>

    private readonly features: Feature[];
    private readonly shpType: ShpType;
    private readonly typeCode: number;
    private readonly isZ: boolean;

    shp: DataView<ArrayBuffer>;
    shx: DataView<ArrayBuffer>;

    private shxOffset: number;
    private shpOffset: number;

    constructor(features: Feature[], shpType: ShpType) {
        this.features = features;
        this.shpType = shpType;
        this.isZ = shpType.includes('Z');
        const [typeCode, func] = this.shpFuncObj[this.shpType];
        this.typeCode = typeCode;
        // 计算长度
        const shpLength = 100 + this.calcFeaturesLength();
        const shxLength = 100 + features.length * 8;

        this.shxOffset = 100;
        this.shpOffset = 100;
        this.shp = new DataView(new ArrayBuffer(shpLength));
        this.shx = new DataView(new ArrayBuffer(shxLength));
        this.writeHeader(this.shp, features);
        this.writeHeader(this.shx, features);
        // 长度
        this.shp.setInt32(24, shpLength / 2);
        this.shx.setInt32(24, (50 + features.length * 4));

        func.call(this, this.features);
    }

    // 写头
    writeHeader(view: DataView, features: Feature[]) {
        let ext = extentFeatures(features);
        view.setInt32(0, 9994);
        view.setInt32(28, 1000, true);
        view.setInt32(32, this.typeCode, true);
        view.setFloat64(36, ext.xmin, true);
        view.setFloat64(44, ext.ymin, true);
        view.setFloat64(52, ext.xmax, true);
        view.setFloat64(60, ext.ymax, true);
        if (this.isZ) {
            view.setFloat64(68, ext.zmin, true);
            view.setFloat64(76, ext.zmax, true);
        }
        view.setFloat64(84, 0, true);
        view.setFloat64(92, 0, true);
        // M范围

    }

    // 生成点
    generatePoint(features: Feature<PointGeometry>[]) {
        // 一个点的总字节100
        features.forEach((feature, i) => {
            const geometry = feature.geometry;
            let startOffset = this.shpOffset
            // 写头
            const len = this.setFeatureHead(i, feature)
            this.setShx(startOffset, len)
            this.setCoordinates(geometry.coordinates)
            if (this.isZ) {
                this.setCoordinatesZ(geometry.coordinates)
            }
        })
    }

    // 生成多点
    generateMultiPoint(features: Feature<MultiPointGeometry>[]) {
        features.forEach((feature, i) => {
            const geometry = feature.geometry;
            let startOffset = this.shpOffset
            // 写头
            const len = this.setFeatureHead(i, feature)
            this.setShx(startOffset, len)
            // bbox
            const bbox = this.setBBox(feature)
            // 总点数
            this.setNumPoints(feature)
            // 所有的点，每个点16字节
            geometry.coordinates.forEach((point) => {
                this.setCoordinates(point)
            })
            if (this.isZ) {
                // 添加范围
                this.setFloat64(bbox.zmin)
                this.setFloat64(bbox.zmax)
                geometry.coordinates.forEach((point) => {
                    this.setCoordinatesZ(point)
                })
            }
        })
    }

    // 生成线
    generatePolylineAndPolygon(features: Feature<LineStringGeometry | MultiLineStringGeometry | MultiPolygonGeometry | PolygonGeometry>[]) {
        features.forEach((feature, i) => {
            // 归一到MultiLineString和Polygon，他俩结构一样
            let coordinates = feature.geometry.coordinates;
            if (feature.geometry.type === "LineString") {
                coordinates = [feature.geometry.coordinates]
            }
            if (feature.geometry.type === "MultiPolygon") {
                coordinates = feature.geometry.coordinates.flat(1)
            }
            feature = {
                ...feature,
                geometry: {
                    ...feature.geometry,
                    type: "MultiLineString",
                    coordinates: coordinates
                }
            } as Feature<MultiLineStringGeometry>
            let startOffset = this.shpOffset
            const geometry = feature.geometry as MultiLineStringGeometry;
            // 写头
            const len = this.setFeatureHead(i, feature)
            this.setShx(startOffset, len)
            // bbox
            const bbox = this.setBBox(feature)
            // 总parts数
            this.setNumParts(feature)
            // 总点数
            this.setNumPoints(feature)

            let points_num = 0
            geometry.coordinates.forEach((points) => {
                // 写parts
                this.shp.setInt32(this.shpOffset, points_num, true)
                this.shpOffset += 4
                points_num += points.length // 计算下一个points的偏移量
            })
            // 所有的点，每个点16字节
            geometry.coordinates.forEach((points) => {
                points.forEach((point) => {
                    this.setCoordinates(point)
                })
            })
            if (this.isZ) {
                // 添加范围
                this.setFloat64(bbox.zmin)
                this.setFloat64(bbox.zmax)
                geometry.coordinates.forEach((points) => {
                    points.forEach((point) => {
                        this.setCoordinatesZ(point)
                    })
                })
            }
        })
    }

    setFeatureHead(index: number, feature: Feature) {
        // 编号
        this.shp.setInt32(this.shpOffset, index + 1)
        // 内容长度 这个是包含了头的长度，所以要减去8
        const len = this.calcFeaturesLength([feature]) - 8
        this.shp.setInt32(this.shpOffset + 4, len >> 1)
        // this.shp.setInt32(this.shpOffset + 4, (len - 8))
        // 类型
        this.shp.setInt32(this.shpOffset + 8, this.typeCode, true)
        this.shpOffset += 12
        return len
    }

    setBBox(feature: Feature) {
        const bbox = extentFeature(feature);
        this.setFloat64(bbox.xmin)
        this.setFloat64(bbox.ymin)
        this.setFloat64(bbox.xmax)
        this.setFloat64(bbox.ymax)
        return bbox
    }

    // 设置Parts的数量
    setNumParts(feature: Feature) {
        const num = this.calcNumParts([feature])
        this.shp.setInt32(this.shpOffset, num, true)
        this.shpOffset += 4
    }

    // 设置parts的数量
    setNumPoints(feature: Feature) {
        const num = this.calcNumPoints([feature])
        this.shp.setInt32(this.shpOffset, num, true)
        this.shpOffset += 4
    }

    setCoordinates(coordinates: Position) {
        this.setFloat64(coordinates[0]) // X
        this.setFloat64(coordinates[1]) // Y
    }

    setCoordinatesZ(coordinates: Position) {
        this.setFloat64(coordinates[2] ?? 0)
    }

    setShx(fileLength: number = 100, len = 8) {
        this.shx.setInt32(this.shxOffset, fileLength / 2) // length in 16-bit words
        this.shx.setInt32(this.shxOffset + 4, len / 2)
        this.shxOffset += 8
    }

    setFloat64(value: number) {
        this.shp.setFloat64(this.shpOffset, value, true) // Z
        this.shpOffset += 8
    }

    // 计算Features需要占领的长度
    calcFeaturesLength(features: Feature[] = this.features) {
        const num = this.calcNumPoints(features);
        const type = this.shpType.replace("Z", "")

        let points_length = num * 16;
        if (this.isZ) {
            points_length += (num * 8 + features.length * 16); // z数值 和 zmin,zmax
            // points_length += (num * 8 + features.length * 16); // z数值 和 zmin,zmax test
        }
        if (type === 'Point') {
            // 记录头8 + 类型4 + 坐标数据
            return features.length * 12 + points_length
        } else if (type === 'MultiPoint') {
            // 记录头8 + 类型4 + bbox32 + 总点数4 + 坐标数据
            return features.length * 48 + points_length
        } else if (type === 'Polyline') {
            // 记录头8 + 类型4 + bbox32 + 总parts数4 + 总点数4 + parts数据*4 + 坐标数据
            return features.length * 52 + this.calcNumParts(features) * 4 + points_length
        } else if (type === 'Polygon') {
            return features.length * 52 + this.calcNumParts(features) * 4 + points_length
        }
        return 8 // 空类型
    }

    // 计算全部点的数量
    calcNumPoints(features: Feature[] = this.features) {
        return features.reduce(function (no, feature) {
            if (feature.properties._numPoints) { // 是否有缓存的数量
                return no + feature.properties._numPoints
            }
            let num = 1
            if (['LineString', 'MultiPoint'].includes(feature.geometry.type)) {
                num = feature.geometry.coordinates.length
            } else if (["MultiLineString", "Polygon"].includes(feature.geometry.type)) {
                num = feature.geometry.coordinates.flat(1).length
            } else if (feature.geometry.type === "MultiPolygon") {
                num = feature.geometry.coordinates.flat(2).length
            }
            feature.properties._numPoints = num
            return no + num
        }, 0)
    }

    calcNumParts(features: Feature[] = this.features) {
        return features.reduce(function (no, feature) {
            if (feature.properties._numParts) { // 是否有缓存的数量
                return no + feature.properties._numParts
            }
            let num = 1
            if (["Polygon", "MultiLineString"].includes(feature.geometry.type)) {
                num = feature.geometry.coordinates.length
            } else if (feature.geometry.type === "MultiPolygon") {
                num = feature.geometry.coordinates.flat(1).length
            }
            feature.properties._numParts = num
            return no + num
        }, 0)
    }
}



