const fs = require('fs');
try {
    const content = fs.readFileSync('C:\\Users\\RAAG0206\\Downloads\\PHARMADOXO 2D 3D.txt', 'utf16le');
    console.log("--- START OF FILE ---");
    console.log(content.substring(0, 3000));
    console.log("--- END OF FILE ---");
} catch (e) {
    console.error(e);
}
