
# 说在前面
> 本库可以正常转换的SHP类型有  
> **Point,Polyline,Polygon,MultiPoint,ZPoint,ZPolyline,ZPolygon,ZMultiPoint**  

_~~暂不支持带M值的SHP类型~~_

# 使用  
安装
```
npm install shp-utils
```
导入
```javascript
import { ShapeAutoToGeoJSON, GeoJSONToShape } from 'shp-utils';
```

# API
## SHP转GeoJSON  

```javascript
// files 是个文件数组，应该包含shp、dbf和cpg文件，其中shp为必须的；您也可以传入一个压缩为zip的压缩包；也可以只传入单个shp文件
ShapeAutoToGeoJSON(files, {
    removeBbox: false // 是否移除bbox属性，默认为false
}).then(geojson => {
    console.log(geojson);
})
```

## GeoJSON转SHP  

```javascript
// geojson 是个geojson对象或者字符串
GeoJSONToShape(geojson, {
    returnFile: false,  // 是否返回File对象，默认返回的是DataView
    returnZip: false, // 是否压缩成一个zip文件
    fileName: 'shape', // 压缩文件名
}).then((zip) => {
    // 保存
    FileSaver.saveAs(zip, zip.name);
})
```

## 其他
提供了一些其他的方法，具体的传值和返回值可以参考一下typescript的类型定义
```javascript
GenerateShpFile(geojson, option) // 生成shp和shx文件
GenerateDbfFile(geojson, option) // 生成dbf和cpg文件

ParseDbfFile(dbfFile, encoding) // 解析dbf文件
ParseShpFile(shpFile, option) // 解析shp文件
```
