import fs from 'fs';
try {
    const raw1 = fs.readFileSync('C:\\Users\\RAAG0206\\Downloads\\PHARMADOXO 2D 3D.txt');
    const b64 = raw1.toString('base64');
    let str = raw1.toString('utf16le');
    if (!str.includes('PHARMA')) {
        str = raw1.toString('utf8');
    }
    const lines = str.split('\n');
    fs.writeFileSync('c:\\Users\\RAAG0206\\Desktop\\crioWebApp\\parsed-format.json', JSON.stringify(lines, null, 2));
    console.log("Wrote parsed-format.json");
} catch (e) { console.error(e) }
