import './style.css'
import {ShapeAutoToGeoJSON,GeoJSONToShape} from '../lib'
import FileSaver from "file-saver";

document.querySelector<HTMLInputElement>('#input')!.onchange = (e: any) => {
    console.log(e.target!.files)
    ShapeAutoToGeoJSON(e.target!.files,{
        removeBbox: true,
    }).then((geojson) => {
        console.log(geojson)
        document.getElementById('output')!.innerHTML = JSON.stringify(geojson, null, 2)
    })
}

document.querySelector<HTMLButtonElement>('#generate')!.onclick = () => {
    const input = document.querySelector<HTMLTextAreaElement>('#textarea')!;
    const j = input.value;
    if (!j) {
        alert('请先输入geojson数据')
        return
    }
    GeoJSONToShape(JSON.parse(j), {
        returnFile: true,
        returnZip: true,
        fileName: 'test1',
    }).then((zip) => {
        FileSaver.saveAs(zip, zip.name);
    })
}
