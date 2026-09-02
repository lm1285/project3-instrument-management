
const XLSX = require('xlsx');
const path = require('path');

function analyzeExcel(filePath) {
    console.log(`Analyzing file: ${filePath}`);
    
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON array of arrays (header: 1 means raw array)
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log(`Sheet: ${sheetName}, Rows: ${data.length}`);
        
        const stdKeywords = ["标准值", "Standard", "标称值", "给定值"];
        const mpeKeywords = ["MPE", "允许误差", "允差", "技术要求", "Limit", "Tolerance"];
        const readKeywords = ["实测值", "测量值", "读数", "Reading", "Measured", "示值"];

        data.forEach((row, rowIndex) => {
            if (!row || row.length === 0) return;
            
            const rowStr = row.map(cell => String(cell || ''));
            
            const hasStd = rowStr.some(cell => stdKeywords.some(k => cell.includes(k)));
            const hasMpe = rowStr.some(cell => mpeKeywords.some(k => cell.includes(k)));
            const hasRead = rowStr.some(cell => readKeywords.some(k => cell.includes(k)));
            
            if (hasStd || hasMpe || hasRead) {
                console.log(`\n[Row ${rowIndex + 1}] Potential Header Found:`);
                // Print non-empty cells for clarity
                console.log(rowStr.map((val, idx) => val ? `[${idx}]${val}` : '').filter(Boolean).join(' | '));
                
                // Infer structure
                let structure = [];
                rowStr.forEach((cell, colIndex) => {
                    if (stdKeywords.some(k => cell.includes(k))) structure.push(`STD(Col ${colIndex})`);
                    if (mpeKeywords.some(k => cell.includes(k))) structure.push(`MPE(Col ${colIndex})`);
                    if (readKeywords.some(k => cell.includes(k))) structure.push(`READ(Col ${colIndex})`);
                });
                
                if (structure.length > 0) {
                    console.log(`  -> Structure: ${structure.join(', ')}`);
                    
                    // Peek at next row
                    if (rowIndex + 1 < data.length) {
                        const nextRow = data[rowIndex + 1].map(c => String(c || ''));
                        console.log(`  -> Next Row: ${nextRow.map((val, idx) => val ? `[${idx}]${val}` : '').filter(Boolean).join(' | ')}`);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error("Error analyzing file:", error);
    }
}

// Get file path from command line or default
const targetFile = process.argv[2] || path.join(__dirname, '../../templates_to_process/VOC.xlsx');
analyzeExcel(targetFile);
