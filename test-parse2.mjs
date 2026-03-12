import fs from 'fs';

let str = fs.readFileSync('C:\\Users\\RAAG0206\\Downloads\\PHARMADOXO 2D 3D.txt', 'utf16le');
if (!str.includes('PHARMA')) str = fs.readFileSync('C:\\Users\\RAAG0206\\Downloads\\PHARMADOXO 2D 3D.txt', 'utf8');

const parseCSV = (text) => {
    const lines = text.trim().split(/\r?\n/)
    const data = Array(8).fill(null).map(() => Array(12).fill(null))

    let foundStructuredData = false
    let colMap = {} // maps token index in line to col index (0-11)
    let currentRowIdx = 0
    let inDataBlock = false

    for (const line of lines) {
        const delimiter = line.includes('\t') ? '\t' : ','
        const tokens = line.split(delimiter).map(t => t.trim())

        const has1 = tokens.includes("1") || tokens.includes('"1"')
        const has2 = tokens.includes("2") || tokens.includes('"2"')

        if (has1 && has2) {
            colMap = {}
            tokens.forEach((t, i) => {
                const cleanT = t.replace(/['"]/g, '')
                const colNum = parseInt(cleanT)
                if (!isNaN(colNum) && colNum >= 1 && colNum <= 12) {
                    colMap[i] = colNum - 1
                }
            })
            inDataBlock = true
            currentRowIdx = 0
            continue
        }

        if (inDataBlock && Object.keys(colMap).length > 0) {
            let explicitRowLetter = null
            for (const t of tokens) {
                const cleanT = t.replace(/['"]/g, '').toUpperCase()
                if (/^[A-H]$/.test(cleanT)) {
                    explicitRowLetter = cleanT
                    break
                }
            }

            if (explicitRowLetter) {
                currentRowIdx = explicitRowLetter.charCodeAt(0) - 65
            }

            if (currentRowIdx > 7) {
                inDataBlock = false
                continue
            }

            let rowHasData = false
            tokens.forEach((t, i) => {
                if (colMap[i] !== undefined) {
                    const cleanT = t.replace(/['"]/g, '')
                    if (cleanT !== "" && cleanT.toUpperCase() !== explicitRowLetter) {
                        const val = parseFloat(cleanT)
                        if (!isNaN(val)) {
                            data[currentRowIdx][colMap[i]] = val
                            rowHasData = true
                            foundStructuredData = true
                        }
                    }
                }
            })

            if (rowHasData || explicitRowLetter) {
                currentRowIdx++
            } else {
                const maxMappedIdx = Math.max(...Object.keys(colMap).map(Number))
                if (tokens.length >= maxMappedIdx && maxMappedIdx > 0) {
                    currentRowIdx++
                }
            }
        }
    }

    return foundStructuredData ? data : false
}

const parsed = parseCSV(str);
console.log(JSON.stringify(parsed, null, 2));
