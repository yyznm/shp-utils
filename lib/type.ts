// 基础坐标类型：[经度, 纬度] 或 [经度, 纬度, 高度]
export type Position = [number, number] | [number, number, number];

// 各种几何类型的坐标定义
 export type PointCoordinates = Position;
 export type LineStringCoordinates = Position[];
 export type PolygonCoordinates = Position[][];  // 第一个数组是外环，后续的是内环
 export type MultiPointCoordinates = Position[];
 export type MultiLineStringCoordinates = Position[][];
 export type MultiPolygonCoordinates = Position[][][];

export type GeoJsonTypes = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

// 为每种几何类型定义具体的类型
export interface PointGeometry {
  type: 'Point';
  coordinates: PointCoordinates;
  bbox?: number[];
}

export interface LineStringGeometry {
  type: 'LineString';
  coordinates: LineStringCoordinates;
  bbox?: number[];
}

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: PolygonCoordinates;
  bbox?: number[];
}

export interface MultiPointGeometry {
  type: 'MultiPoint';
  coordinates: MultiPointCoordinates;
  bbox?: number[];
}

export interface MultiLineStringGeometry {
  type: 'MultiLineString';
  coordinates: MultiLineStringCoordinates;
  bbox?: number[];
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: MultiPolygonCoordinates;
  bbox?: number[];
}

// 联合类型包含所有可能的几何类型
export type GeoJsonGeometry =
  | PointGeometry
  | LineStringGeometry
  | PolygonGeometry
  | MultiPointGeometry
  | MultiLineStringGeometry
  | MultiPolygonGeometry;

export interface Feature<T = GeoJsonGeometry> {
  type: 'Feature';
  geometry: T;
  properties: Record<string, any>;
  bbox?: number[];
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
  bbox?: number[];
}

