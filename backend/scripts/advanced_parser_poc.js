
const XLSX = require('xlsx');

// --- Mock Data ---
const mockData = [
    // --- Header ---
    ["Calibration Certificate", "", "", "", ""],
    ["", "", "", "", ""],
    
    // --- Scenario 1: Indication Error (Standard Table) ---
    ["一、示值误差 (Indication Error)", "", "", "", ""],
    ["序号", "标准值 (V)", "示值 (V)", "MPE (V)", "结论"], // Header Row
    ["1", "1.00", "1.01", "±0.05", "P"],             // Data
    ["2", "2.00", "2.02", "±0.05", "P"],             // Data
    ["3", "5.00", "5.01", "±0.10", "P"],             // Data
    ["", "", "", "", ""],                            // Gap
    
    // --- Scenario 2: Implicit Standard (Repeatability - Random Row Reference) ---
    // User Requirement: Might reference 1st, 3rd, or any specific standard from previous table
    ["二、重复性 (Repeatability)", "", "", "", ""], 
    ["测量次数", "读数 1", "读数 2", "读数 3", "极差"], 
    ["5V Point", "5.001", "5.002", "5.001", "0.001"],  // References 5.00 (Row 3 of previous table)
    ["", "", "", "", ""],
    
    // --- Scenario 3: Ambiguous/No Match ---
    ["三、稳定性 (Stability)", "", "", "", ""],
    ["测量次数", "读数 1", "读数 2", "读数 3", "极差"], 
    ["Test Point", "1.001", "1.002", "1.001", "0.001"], // "Test Point" is vague, defaults to 1st or asks user?
    ["", "", "", "", ""],
    
    // --- Scenario 3: Multiple Sets (Voltage & Current) ---
    ["三、多通道测量 (Multi-Channel)", "", "", "", "", "", ""],
    ["项目", "通道A标准", "通道A实测", "通道B标准", "通道B实测", "MPE", "结论"], // Complex Header
    ["测试1", "10.0", "10.1", "20.0", "20.0", "±1%", "P"],
    ["测试2", "50.0", "50.2", "100.0", "100.1", "±1%", "P"],
    
    // --- End ---
    ["备注", "无", "", "", ""]
];

// --- Parser Logic ---

class ExcelParser {
    constructor() {
        this.keywords = {
            std: ["标准", "Standard", "Ref", "标称", "Nominal"],
            mpe: ["MPE", "允许误差", "允差", "Limit", "Tolerance", "技术要求"],
            read: ["示值", "实测", "读数", "Reading", "Measured", "Result"],
            stop: ["结论", "备注", "Conclusion", "Remark", "Auditor"]
        };
        this.blocks = [];
    }

    // Helper: Identify if a row acts as a Header
    identifyHeader(rowStr) {
        // A row is a header if it contains keywords for (Standard OR MPE) AND (Read)
        // OR just Read (for implicit cases)
        const hasStd = rowStr.some(c => this.keywords.std.some(k => c.includes(k)));
        const hasMpe = rowStr.some(c => this.keywords.mpe.some(k => c.includes(k)));
        const hasRead = rowStr.some(c => this.keywords.read.some(k => c.includes(k)));
        
        // Strictness: Must have at least "Read" to be a measurement table
        // Ideally also "Std" or "Mpe" to confirm it's not just random text
        return hasRead && (hasStd || hasMpe || rowStr.some(c => c.includes("次数"))); 
    }

    parse(data) {
        console.log("Starting Semantic Parse...\n");
        
        let currentBlock = null;

        for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
            const row = data[rowIndex];
            const rowStr = row.map(c => (c === undefined || c === null) ? "" : String(c).trim());
            const isEmpty = rowStr.every(c => c === "");
            
            // 1. Check for New Block Start (Header Detection)
            if (this.identifyHeader(rowStr)) {
                // Close previous block
                if (currentBlock) {
                    this.finalizeBlock(currentBlock);
                }
                
                console.log(`[Line ${rowIndex+1}] Found Table Header: ${JSON.stringify(rowStr)}`);
                currentBlock = {
                    startRow: rowIndex,
                    header: rowStr,
                    rows: [],
                    colMap: this.mapColumns(rowStr)
                };
                continue; // Skip processing this row as data
            }

            // 2. Process Block Data
            if (currentBlock) {
                // Check termination conditions
                const isStopLine = rowStr.some(c => this.keywords.stop.some(k => c === k || c.startsWith(k)));
                
                if (isStopLine) {
                    console.log(`[Line ${rowIndex+1}] Block terminated by keyword: "${rowStr.find(c => this.keywords.stop.some(k => c.startsWith(k)))}"`);
                    this.finalizeBlock(currentBlock);
                    currentBlock = null;
                    continue;
                }

                if (!isEmpty) {
                    currentBlock.rows.push({
                        line: rowIndex + 1,
                        data: rowStr
                    });
                } else {
                    // Soft termination? For now, ignore empty lines or use counter
                    // If 2 empty lines -> terminate?
                }
            }
        }

        // Finalize last block
        if (currentBlock) {
            this.finalizeBlock(currentBlock);
        }
    }

    mapColumns(headerRow) {
        const map = { std: [], mpe: [], read: [] };
        headerRow.forEach((cell, idx) => {
            if (this.keywords.std.some(k => cell.includes(k))) map.std.push(idx);
            if (this.keywords.mpe.some(k => cell.includes(k))) map.mpe.push(idx);
            if (this.keywords.read.some(k => cell.includes(k))) map.read.push(idx);
        });
        return map;
    }

    finalizeBlock(block) {
        console.log(`\n--- Block Analysis (Start: Row ${block.startRow + 1}, Data Rows: ${block.rows.length}) ---`);
        const colMap = block.colMap;
        
        // --- Q1: Multiple Standards & Measures ---
        if (colMap.std.length > 0) {
            console.log(`  Type: Independent Measurement (Has explicit Standard)`);
            
            // Logic: How to pair Std with Read?
            if (colMap.std.length === colMap.read.length) {
                console.log(`  Mapping: 1-to-1 Pairing (Detected ${colMap.std.length} pairs)`);
                colMap.read.forEach((readCol, i) => {
                    console.log(`    Meas Col [${readCol}] <--> Std Col [${colMap.std[i]}]`);
                });
            } else if (colMap.std.length === 1 && colMap.read.length > 1) {
                console.log(`  Mapping: 1-to-N Broadcast`);
                console.log(`    Std Col [${colMap.std[0]}] applies to ALL Meas Cols ${JSON.stringify(colMap.read)}`);
            } else {
                console.log(`  Mapping: Complex/Mixed (Proximity Check)`);
                // Proximity check: For each Read col, find closest Std col to its left
                colMap.read.forEach(readCol => {
                    const leftStds = colMap.std.filter(s => s < readCol);
                    const bestStd = leftStds.length > 0 ? leftStds[leftStds.length - 1] : "UNKNOWN";
                    console.log(`    Meas Col [${readCol}] linked to Std Col [${bestStd}]`);
                });
            }
        } 
        // --- Q2: Implicit Standards ---
        else {
            console.log(`  Type: Dependent/Implicit Measurement (No explicit Standard column)`);
            
            // Logic: Context Propagation
            // Try to find a previous block with Standards
            if (this.blocks.length > 0) {
                // Find nearest previous block with Standards
                const parentBlock = [...this.blocks].reverse().find(b => b.colMap.std.length > 0);
                
                if (parentBlock) {
                     console.log(`  Action: Found Parent Block (Row ${parentBlock.startRow + 1})`);
                     console.log(`    -> Attempting Fuzzy Row Matching...`);
                     
                     // Iterate through rows of current block to find matches
                     block.rows.forEach(currentRow => {
                         const rowLabel = currentRow.data[0]; // Assume first column is label/description
                         const match = this.findMatchingStandard(rowLabel, parentBlock);
                         
                         if (match) {
                             console.log(`    [Row ${currentRow.line}] Label "${rowLabel}" matched Standard Value "${match.value}" (from Parent Row ${match.row})`);
                         } else {
                             console.log(`    [Row ${currentRow.line}] Label "${rowLabel}" - No clear match found. Defaulting to First Standard (${parentBlock.rows[0].data[parentBlock.colMap.std[0]]}) or asking user.`);
                         }
                     });
                     
                } else {
                    console.log(`  Action: Search Row Headers for implicit values (e.g. "10V Point")`);
                }
            } else {
                console.log(`  Action: Search Row Headers (e.g. "10V Point")`);
            }
        }
        
        this.blocks.push(block);
    }

    findMatchingStandard(label, parentBlock) {
        if (!label) return null;
        
        // Strategy 1: Extract number from label (e.g., "5V Point" -> 5)
        const labelNum = parseFloat(label.replace(/[^0-9.]/g, ''));
        
        // Search parent block's standard column
        const stdColIdx = parentBlock.colMap.std[0]; // Assume first standard column
        
        // 1. Try Exact Numeric Match
        if (!isNaN(labelNum)) {
            for (const parentRow of parentBlock.rows) {
                const stdValStr = parentRow.data[stdColIdx];
                const stdVal = parseFloat(stdValStr);
                
                // Simple proximity check (e.g., within 1%)
                if (!isNaN(stdVal) && Math.abs(stdVal - labelNum) < (stdVal * 0.01 || 0.0001)) {
                    return { value: stdValStr, row: parentRow.line, strategy: "numeric" };
                }
            }
        }
        
        // 2. Try Text Semantic Match (if numeric failed)
        // e.g. Label="Max Point", ParentRow="Max"
        // This is simplified here but can be expanded
        
        return null;
    }
}

// Run the mock parser
const parser = new ExcelParser();
parser.parse(mockData);
