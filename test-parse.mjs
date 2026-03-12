import fs from "fs";
import { transformExcelToFortune } from "@zenmrp/fortune-sheet-excel";
import { File } from 'buffer';

const buf = fs.readFileSync("Matrix_CPAs.xlsx");
const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
const file = new File([blob], 'Matrix_CPAs.xlsx')

transformExcelToFortune(file).then(res => {
    console.log("Parsed OK!");
    if (res.sheets && res.sheets.length > 0) {
        console.log("Sheet[0] keys:", Object.keys(res.sheets[0]))
        if (res.sheets[0].celldata) {
            console.log("celldata length:", res.sheets[0].celldata.length)
            const rowMax = Math.max(...res.sheets[0].celldata.map(c => c.r));
            const colMax = Math.max(...res.sheets[0].celldata.map(c => c.c));
            console.log("Max row:", rowMax, "Max Col:", colMax);
        }
        if (res.sheets[0].data) {
            console.log("data length (2d array rows):", res.sheets[0].data.length)
        }
    }
}).catch(console.error);
