import { polygon as turfPolygon } from "@turf/helpers";
import { booleanWithin } from "@turf/boolean-within";
import {ToDataView} from "../utils/file.ts";
import {
    GeoJsonGeometry,
    LineStringGeometry,
    MultiLineStringGeometry,
    MultiPointGeometry, MultiPolygonGeometry,
    PointCoordinates,
    PointGeometry, PolygonCoordinates, PolygonGeometry, Position
} from "../type";


export default async function (data: File | ArrayBuffer | DataView, option?: OptionType): Promise<(GeoJsonGeometry | null)[]> {
    const view = await ToDataView(data);
    const geojson = new ShpFile(view, option).geometrys;
    if (option?.removeBbox) {
        for (let i = 0; i < geojson.length; i++) {
            if (geojson[i] && geojson[i]!.bbox) {
                delete geojson[i]!.bbox
            }
        }
    }
    return geojson;
};

type OptionType = {
    removeBbox?: boolean
}

class ShpFile {
    private readonly buffer: DataView;
    option: OptionType;
    private headers: { shpCode: number; bbox: number[]; length: number; version: number };
    geometrys: (GeoJsonGeometry | null)[];
    private shpFuncObj: Record<number, () => GeoJsonGeometry | null> = {
        1: this.parsePoint,
        3: this.parsePolyline,
        5: this.parsePolygon,
        8: this.parseMultiPoint,
        11: this.parsePoint,
        13: this.parsePolyline,
        15: this.parsePolygon,
        18: this.parseMultiPoint
    }
    private offset: number;
    private readonly isZ: boolean;

    constructor(buffer: DataView, option: OptionType = {}) {
        this.option = option;
        this.buffer = buffer;
        this.headers = this.parseHeader();
        this.offset = 100;
        this.isZ = [11, 13, 15, 18].includes(this.headers.shpCode)
        this.geometrys = this.getGeometrys();
    }

    getGeometrys() {
        const out: (GeoJsonGeometry | null)[] = [];
        while (this.offset < this.headers.length) {
            // const id = this.buffer.getInt32(this.offset);
            const len = this.buffer.getInt32(this.offset + 4) << 1;
            const type = this.buffer.getInt32(this.offset + 8, true)
            // 超出了文件长度
            if (this.offset + len + 8 > this.buffer.byteLength) {
                break;
            }
            if (type !== 0 && (!type || !this.shpFuncObj[type])) {
                throw new Error(`不支持的类型 "${type}"`);
            }
            this.offset += 12; // 每个记录的头部有8字节+4字节
            if (type === 0) { // 跳过空的shp
                this.offset += 4;
                continue
            }
            out.push(this.shpFuncObj[type].bind(this)());
        }
        return out;
    }

    parseHeader() {
        return {
            length: this.buffer.getInt32(24) << 1,
            version: this.buffer.getInt32(28, true),
            shpCode: this.buffer.getInt32(32, true),
            bbox: [
                this.buffer.getFloat64(36, true),
                this.buffer.getFloat64(44, true),
                this.buffer.getFloat64(52, true),
                this.buffer.getFloat64(60, true)
            ]
        };
    }


    parsePoint(): PointGeometry {
        let point = this.getPoint();
        if (this.isZ) {
            point.push(this.getFloat64()) // 增加z值
        }
        return {
            type: 'Point',
            coordinates: point
        };
    }

    // 多点
    parseMultiPoint() {
        const bbox = this.getBBOX()
        const numPoints = this.getInt32();
        if (!numPoints) {
            throw new Error('无效的多点数据');
        }
        let arr: Position[] = []
        for (let i = 0; i < numPoints; i++) {
            arr.push(this.getPoint())
        }
        if (this.isZ) {
            //Z的上下界
            this.offset += 16 //跳过Z的上下界
            // Z的值
            for (let i = 0; i < numPoints; i++) {
                arr[i].push(this.getFloat64()) // 增加z值
            }
        }
        return {
            type: 'MultiPoint',
            coordinates: arr,
            bbox: bbox
        } as MultiPointGeometry;
    }

    parsePolyline() {
        const bbox = this.getBBOX()
        const numParts = this.getInt32();
        const numPoints = this.getInt32();
        if (!numParts || !numPoints) {
            throw new Error('无效的Shp数据');
        }
        // 获取的part, 每个环的起点位置
        const parts = [] as number[];
        for (let i = 0; i < numParts; i++) {
            parts.push(this.getInt32());
        }
        parts.push(numPoints) // 添加一个结束位置
        let coordinates: PointCoordinates[][] = [];
        let total = 0;
        for (let i = 0; i < numParts; i++) {
            let arr = []
            while (total < parts[i + 1]) {
                arr.push(this.getPoint())
                total++
            }
            coordinates.push(arr)
        }

        // 是否有z值
        if (this.isZ) {
            //Z的上下界
            this.offset += 16 //跳过Z的上下界
            // Z的值
            for (let i = 0; i < coordinates.length; i++) {
                for (let j = 0; j < coordinates[i].length; j++) {
                    coordinates[i][j].push(this.getFloat64()) // 增加z值
                }
            }
        }

        if (coordinates.length === 1) {
            return {
                type: 'LineString',
                coordinates: coordinates[0],
                bbox: bbox
            } as LineStringGeometry;
        }
        return {
            type: 'MultiLineString',
            coordinates: coordinates,
            bbox: bbox
        } as MultiLineStringGeometry;
    }


    parsePolygon() {
        // 格式一样，使用线解析多边形
        let out = this.parsePolyline();
        if (out.type === 'LineString') {
            return {
                type: 'Polygon',
                coordinates: [out.coordinates],
                bbox: out.bbox
            } as PolygonGeometry;
        }
        return {
            type: 'MultiPolygon',
            coordinates: handleRings(out.coordinates as PointCoordinates[][]),
            bbox: out.bbox
        } as MultiPolygonGeometry;
    }

    getBBOX() {
        let arr = [
            this.buffer.getFloat64(this.offset, true),
            this.buffer.getFloat64(this.offset + 8, true),
            this.buffer.getFloat64(this.offset + 16, true),
            this.buffer.getFloat64(this.offset + 24, true)
        ];
        this.offset += 32;
        return arr
    }

    getInt32() {
        this.offset += 4;
        return this.buffer.getInt32(this.offset - 4, true)
    }

    getFloat64() {
        this.offset += 8;
        return this.buffer.getFloat64(this.offset - 8, true)
    }

    // 获取一个点
    getPoint(): PointCoordinates {
        return [
            this.getFloat64(),
            this.getFloat64()
        ] as PointCoordinates
    }
}

// 判断是否为顺时针
function isClockWise(array: PointCoordinates[]) {
    let sum = 0;
    let i = 1;
    const len = array.length;
    let prev, cur;
    const bbox = [array[0][0], array[0][1], array[0][0], array[0][1]];
    while (i < len) {
        prev = cur || array[0];
        cur = array[i];
        sum += ((cur[0] - prev[0]) * (cur[1] + prev[1]));
        i++;
        if (cur[0] < bbox[0]) {
            bbox[0] = cur[0];
        }
        if (cur[1] < bbox[1]) {
            bbox[1] = cur[1];
        }
        if (cur[0] > bbox[2]) {
            bbox[2] = cur[0];
        }
        if (cur[1] > bbox[3]) {
            bbox[3] = cur[1];
        }
    }
    return {
        ring: array as PointCoordinates[],
        clockWise: sum > 0,
        bbox,
        children: [] as PolygonCoordinates,
        polygon: turfPolygon([array])
    }
}

function handleRings(rings: PolygonCoordinates) {
    const outers: ReturnType<typeof isClockWise>[] = [];
    const inners: ReturnType<typeof isClockWise>[] = [];
    for (const ring of rings) {
        const proccessed = isClockWise(ring);
        if (proccessed.clockWise) {
            outers.push(proccessed)
        } else {
            inners.push(proccessed)
        }
    }
    // inners // 可能是挖孔数据
    for (const inner of inners) {
        // 是否是某个面的内环
        outers.some((outer) => {
            // 是否在面里面
            if (booleanWithin(inner.polygon, outer.polygon)) {
                outer.children.push(inner.ring);
                return true;
            }
        }) || outers.push(inner); // 不是挖孔数据，直接添加到外环
    }
    const out = [];
    for (const outer of outers) {
        out.push([outer.ring].concat(outer.children));
    }
    return out;
}
