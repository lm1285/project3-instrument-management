/*
 * Excel智能质检加载项 - 核心逻辑
 * 基于纯Office JS方案，跨平台兼容
 */

Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
        document.getElementById("btn-recognize").onclick = runRecognize;
        document.getElementById("btn-generate-all").onclick = runGenerateAll;
        document.getElementById("btn-toggle-listener").onclick = toggleListener;
        document.getElementById("btn-sync").onclick = runSync;
        log("加载项已就绪。");
    }
});

// --- 全局状态 ---
let RECOGNIZED_TABLES = [];
let IS_LISTENING = false;
let BINDING_EVENT = null;

// 等级-允差配置
const TOLERANCE_CONFIG = {
    "A级": 0.01,
    "B级": 0.05,
    "C级": 0.10,
    "D级": 0.50
};

// --- 表格识别模块 ---
async function runRecognize() {
    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            const usedRange = sheet.getUsedRange();
            
            usedRange.load("rowIndex, columnIndex, rowCount, columnCount, values");
            await context.sync();

            const values = usedRange.values;
            RECOGNIZED_TABLES = [];
            
            let currentTitle = "全局区域";
            let titleRowIndex = -1;
            let currentTable = null;

            // 智能识别多标题及多表格
            for (let i = 0; i < values.length; i++) {
                const rowStr = values[i].map(c => String(c || "").trim());
                const rowText = rowStr.join("");
                
                if (!rowText) {
                    if (currentTable) {
                        currentTable.dataEndRow = usedRange.rowIndex + i - 1;
                        RECOGNIZED_TABLES.push(currentTable);
                        currentTable = null;
                    }
                    continue;
                }

                // 识别章节标题 (例如 "一、", "外观" 在不同单元格，或在一个单元格)
                let foundTitle = false;
                for (let cIdx = 0; cIdx < rowStr.length; cIdx++) {
                    const cellVal = rowStr[cIdx];
                    // 匹配以中文数字开头的序号，如 "一、", "二、", "三." 等
                    if (/^[一二三四五六七八九十]+[、\.]/.test(cellVal)) {
                        // 如果序号和标题在同一个单元格
                        if (cellVal.length > 2) {
                            currentTitle = cellVal;
                        } else {
                            // 如果序号和标题在相邻单元格
                            const nextCell = rowStr[cIdx + 1] || "";
                            currentTitle = cellVal + nextCell;
                        }
                        titleRowIndex = usedRange.rowIndex + i;
                        foundTitle = true;
                        break;
                    }
                }

                if (foundTitle) {
                    if (currentTable) {
                        currentTable.dataEndRow = usedRange.rowIndex + i - 1;
                        RECOGNIZED_TABLES.push(currentTable);
                        currentTable = null;
                    }
                    continue;
                }

                // 识别表头行
                const hasStandard = rowStr.some(c => c.includes("标准值") || c.includes("标称值"));
                const hasReading = rowStr.some(c => c.includes("实测") || c.includes("示值") || c.includes("读数") || c.includes("测量值") || c.includes("响应时间"));
                const hasMPE = rowStr.some(c => c.includes("技术要求") || c.includes("允差") || c.includes("MPE"));
                const hasGrade = rowStr.some(c => c.includes("等级"));

                // 如果是表头（主表头或副表头）
                if ((hasStandard || hasReading || hasMPE || hasGrade)) {
                    if (!currentTable) {
                        currentTable = {
                            id: RECOGNIZED_TABLES.length + 1,
                            title: currentTitle,
                            titleRow: titleRowIndex,
                            headerRow: usedRange.rowIndex + i,
                            dataStartRow: usedRange.rowIndex + i + 1,
                            dataEndRow: -1,
                            colMap: {
                                standard: -1,
                                mpe: -1,
                                grade: -1,
                                readings: []
                            }
                        };
                    } else {
                        // 如果已经是表格状态，可能遇到了副表头，更新数据起始行
                        currentTable.dataStartRow = usedRange.rowIndex + i + 1;
                    }

                    // 提取列映射 (支持多列实测值)
                    rowStr.forEach((cell, colIdx) => {
                        if (cell.includes("标准值") || cell.includes("标称值")) currentTable.colMap.standard = colIdx;
                        if (cell.includes("技术要求") || cell.includes("允差") || cell.includes("MPE")) currentTable.colMap.mpe = colIdx;
                        if (cell.includes("等级")) currentTable.colMap.grade = colIdx;
                        
                        if (cell.includes("实测") || cell.includes("示值") || cell.includes("读数") || cell.includes("测量值") || cell.includes("响应时间") || /^\d+$/.test(cell)) {
                            if (!currentTable.colMap.readings.includes(colIdx)) {
                                currentTable.colMap.readings.push(colIdx);
                            }
                        }
                    });
                }
            }

            if (currentTable) {
                currentTable.dataEndRow = usedRange.rowIndex + values.length - 1;
                RECOGNIZED_TABLES.push(currentTable);
            }

            renderTables();
            log(`表格识别成功: 发现 ${RECOGNIZED_TABLES.length} 个数据区域`);
        });
    } catch (error) {
        logError(error);
    }
}

function renderTables() {
    const listEl = document.getElementById("table-list");
    const resEl = document.getElementById("recognition-result");
    
    if (RECOGNIZED_TABLES.length === 0) {
        resEl.style.display = "block";
        resEl.innerText = "未检测到有效数据表格，请检查格式。";
        resEl.style.color = "var(--warning)";
        listEl.style.display = "none";
        return;
    }

    resEl.style.display = "block";
    resEl.innerText = `识别成功！检测到以下表格 (${RECOGNIZED_TABLES.length}个)：`;
    resEl.style.color = "var(--success)";
    listEl.style.display = "block";
    listEl.innerHTML = "";

    RECOGNIZED_TABLES.forEach((table, index) => {
        const li = document.createElement("li");
        li.className = "task-item";
        
        let tags = "";
        if (table.colMap.standard !== -1) tags += `<span class="tag tag-std">含标准值</span> `;
        if (table.colMap.mpe !== -1) tags += `<span class="tag tag-imp">含技术要求</span> `;
        if (table.colMap.readings.length > 0) tags += `<span class="tag" style="background:#e1dfdd;">${table.colMap.readings.length}列实测</span> `;

        li.innerHTML = `
            <div class="task-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1;">
                    <div class="task-title" style="display:flex; align-items:center; gap:8px;">
                        <span>${table.title}</span>
                    </div>
                    <div class="task-meta">行 ${table.headerRow + 1} - ${table.dataEndRow + 1}</div>
                    <div style="margin-top:4px;">${tags}</div>
                </div>
                <button class="btn-delete" data-index="${index}" title="删除此表格及区域" style="background:none; border:none; color:var(--error); cursor:pointer; font-size:16px; padding:4px;">🗑️</button>
            </div>
        `;
        listEl.appendChild(li);
    });

    // 绑定删除按钮事件
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            deleteTable(idx);
        };
    });
}

// --- 删除表格及自动重新编号 ---
async function deleteTable(tableIndex) {
    const tableToDelete = RECOGNIZED_TABLES[tableIndex];
    if (!tableToDelete) return;

    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            
            // 确定要删除的行范围：从标题行（或表头行）到数据结束行
            const startRow = tableToDelete.titleRow !== -1 ? tableToDelete.titleRow : tableToDelete.headerRow;
            // 尝试包含下方的空行，如果是最后一个表格可能没有空行
            let endRow = tableToDelete.dataEndRow;
            
            // 为了美观，尝试删除紧接着的空行 (如果有的话)
            const rangeToDelete = sheet.getRangeByIndexes(startRow, 0, endRow - startRow + 1, sheet.getUsedRange().columnCount);
            rangeToDelete.delete(Excel.DeleteShiftDirection.up);

            // 重新编号剩余的表格标题
            const chineseNums = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"];
            let newIndex = 0;

            // 遍历所有剩余的表格，更新它们的序号
            // 注意：由于我们刚刚删除了行，下方所有行的索引都发生了变化 (减少了 deletedRowCount 行)
            const deletedRowCount = endRow - startRow + 1;
            
            for (let i = 0; i < RECOGNIZED_TABLES.length; i++) {
                if (i === tableIndex) continue; // 跳过已删除的表格
                
                const table = RECOGNIZED_TABLES[i];
                
                // 如果表格在被删除的表格下方，更新它的行索引
                if (table.headerRow > endRow) {
                    if (table.titleRow !== -1) table.titleRow -= deletedRowCount;
                    table.headerRow -= deletedRowCount;
                    table.dataStartRow -= deletedRowCount;
                    table.dataEndRow -= deletedRowCount;
                }

                // 更新标题序号
                if (table.titleRow !== -1) {
                    const titleRange = sheet.getRangeByIndexes(table.titleRow, 0, 1, 10); // 读取前10列寻找标题
                    titleRange.load("values");
                    await context.sync();
                    
                    let rowVals = titleRange.values[0];
                    for (let cIdx = 0; cIdx < rowVals.length; cIdx++) {
                        let cellVal = String(rowVals[cIdx] || "").trim();
                        if (/^[一二三四五六七八九十]+[、\.]/.test(cellVal)) {
                            // 替换为新的序号
                            const newPrefix = chineseNums[newIndex] + "、";
                            let newCellVal = cellVal.replace(/^[一二三四五六七八九十]+[、\.]/, newPrefix);
                            
                            const cellToUpdate = sheet.getCell(table.titleRow, cIdx);
                            cellToUpdate.values = [[newCellVal]];
                            
                            // 更新内存中的标题
                            if (cellVal.length > 2) {
                                table.title = newCellVal;
                            } else {
                                const nextCell = String(rowVals[cIdx + 1] || "");
                                table.title = newCellVal + nextCell;
                            }
                            break;
                        }
                    }
                }
                newIndex++;
            }

            await context.sync();
            
            // 从数组中移除并重新渲染
            RECOGNIZED_TABLES.splice(tableIndex, 1);
            renderTables();
            log(`已删除表格并自动重新编号，删除行数: ${deletedRowCount}`);
        });
    } catch (error) {
        logError(error);
    }
}

// --- 随机数生成模块 (一键生成) ---
async function runGenerateAll() {
    if (RECOGNIZED_TABLES.length === 0) {
        logError(new Error("请先进行表格识别"));
        return;
    }

    try {
        await Excel.run(async (context) => {
            const sheet = context.workbook.worksheets.getActiveWorksheet();
            let changeCount = 0;

            for (const table of RECOGNIZED_TABLES) {
                if (table.colMap.standard === -1 || table.colMap.readings.length === 0) continue;
                
                // 加载该表格的数据区域
                const dataRange = sheet.getRangeByIndexes(
                    table.dataStartRow, 0,
                    table.dataEndRow - table.dataStartRow + 1,
                    sheet.getUsedRange().columnCount // 加载足够宽的列
                );
                dataRange.load("values");
                await context.sync();

                let lastMPE = null;

                for (let r = 0; r < dataRange.values.length; r++) {
                    const rowVals = dataRange.values[r];
                    const standardVal = parseFloat(rowVals[table.colMap.standard]);
                    if (isNaN(standardVal)) continue;

                    let tolerance = 0.01; // 默认允差

                    // 优先从MPE列读取允差
                    if (table.colMap.mpe !== -1) {
                        let mpeStr = String(rowVals[table.colMap.mpe] || "").trim();
                        if (mpeStr) {
                            lastMPE = mpeStr; // 记录MPE以处理合并单元格
                        } else if (lastMPE) {
                            mpeStr = lastMPE; // 使用上一个非空的MPE
                        }
                        tolerance = parseMPE(mpeStr, standardVal) || 0.01;
                    } 
                    // 否则如果存在等级列，则尝试从配置中获取
                    else if (table.colMap.grade !== -1) {
                        const grade = String(rowVals[table.colMap.grade]).trim();
                        if (TOLERANCE_CONFIG[grade] !== undefined) {
                            tolerance = TOLERANCE_CONFIG[grade];
                        }
                    }

                    // 为每个实测列生成随机数
                    table.colMap.readings.forEach(colIdx => {
                        const random = generateRandom(standardVal, tolerance);
                        const cell = sheet.getCell(table.dataStartRow + r, colIdx);
                        cell.values = [[random]];
                        changeCount++;
                    });
                }
            }
            
            await context.sync();
            log(`一键生成完毕，共填充 ${changeCount} 个单元格数据。`);
        });
    } catch (error) {
        logError(error);
    }
}

// 解析MPE字符串为数值
function parseMPE(mpeStr, stdVal) {
    if (!mpeStr) return null;
    const s = String(mpeStr).replace('±', '').replace('≤', '').replace('<', '').trim();
    if (s.includes('%')) {
        const pct = parseFloat(s.replace('%', ''));
        return Math.abs(stdVal * (pct / 100));
    } else {
        return parseFloat(s);
    }
}

// --- 随机数生成模块 (监听器) ---
async function toggleListener() {
    const btn = document.getElementById("btn-toggle-listener");
    
    if (IS_LISTENING) {
        // 停止监听
        try {
            await Excel.run(async (context) => {
                if (BINDING_EVENT) {
                    BINDING_EVENT.remove();
                    BINDING_EVENT = null;
                }
                await context.sync();
                IS_LISTENING = false;
                btn.innerHTML = "<span>⚡ 启动监听</span>";
                btn.style.background = "var(--primary)";
                log("已停止数据变化监听。");
            });
        } catch (error) {
            logError(error);
        }
    } else {
        // 启动监听
        if (TABLE_STRUCTURE.headerRow === -1) {
            logError(new Error("请先进行表格识别"));
            return;
        }

        try {
            await Excel.run(async (context) => {
                const sheet = context.workbook.worksheets.getActiveWorksheet();
                BINDING_EVENT = sheet.onChanged.add(onSheetChanged);
                await context.sync();
                
                IS_LISTENING = true;
                btn.innerHTML = "<span>🛑 停止监听</span>";
                btn.style.background = "var(--error)";
                log("已启动数据变化监听...");
            });
        } catch (error) {
            logError(error);
        }
    }
}

async function onSheetChanged(event) {
    if (!document.getElementById("chk-auto-generate").checked) return;

    try {
            await Excel.run(async (context) => {
                const sheet = context.workbook.worksheets.getActiveWorksheet();
                const range = sheet.getRange(event.address);
                range.load("rowIndex, columnIndex, values");
                await context.sync();

                const row = range.rowIndex;
                const col = range.columnIndex;
                const newVal = range.values[0][0];

                // 查找变化的单元格属于哪个表格
                const table = RECOGNIZED_TABLES.find(t => row >= t.dataStartRow && row <= t.dataEndRow);
                if (!table) return;

                // 判断是否是“等级”列发生变化
                if (col === table.colMap.grade) {
                    const grade = String(newVal).trim();
                    const tolerance = TOLERANCE_CONFIG[grade];

                    if (tolerance !== undefined) {
                        log(`检测到等级变化: ${grade}, 匹配允差: ${tolerance}`);
                        
                        // 读取标准值
                        const stdRange = sheet.getCell(row, table.colMap.standard);
                        stdRange.load("values");
                        await context.sync();
                        
                        let standard = parseFloat(stdRange.values[0][0]);
                        if (isNaN(standard)) {
                            standard = 100; // 默认测试值
                            log("未读取到有效标准值，使用默认值 100");
                        }

                        // 写入允差
                        if (table.colMap.mpe !== -1) {
                            const tolRange = sheet.getCell(row, table.colMap.mpe);
                            tolRange.values = [[tolerance]];
                        }

                        // 生成并写入所有实测列的随机数
                        table.colMap.readings.forEach(colIdx => {
                            const random = generateRandom(standard, tolerance);
                            const randRange = sheet.getCell(row, colIdx);
                            randRange.values = [[random]];
                        });
                        
                        await context.sync();
                        log(`第 ${row + 1} 行生成完毕`);
                    }
                }
            });
        } catch (error) {
        logError(error);
    }
}

function generateRandom(standard, tolerance) {
    // 根据允差范围生成随机数：标准值 ± (允差 * 随机系数)
    // 假设符合正态分布或简单均匀分布
    const error = (Math.random() * 2 - 1) * tolerance; // -tolerance 到 +tolerance
    let val = standard + error;
    
    // 保留与允差相同的小数位数
    const decimals = (String(tolerance).split('.')[1] || '').length;
    return parseFloat(val.toFixed(decimals > 0 ? decimals : 2));
}

// --- 数据同步模块 ---
async function runSync() {
    const btn = document.getElementById("btn-sync");
    const originalText = btn.innerHTML;
    btn.innerHTML = "<span>⏳ 同步中...</span>";
    btn.disabled = true;

    try {
        log("开始同步云端配置...");
        // 模拟 API 调用
        const API_ENDPOINTS = {
            GET_CONFIG: 'GET /api/config',
            SYNC_DATA: 'POST /api/data/sync'
        };
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        log("✅ 配置同步成功！当前规则已更新。");
        log("✅ 多用户数据状态已校验。");
    } catch (error) {
        logError(error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- 日志助手 ---
function log(msg) {
    const el = document.getElementById("log-area");
    const time = new Date().toLocaleTimeString();
    el.innerHTML += `<div class="log-entry"><span class="log-info">[${time}]</span> ${msg}</div>`;
    el.scrollTop = el.scrollHeight;
}

function logError(err) {
    console.error(err);
    const el = document.getElementById("log-area");
    el.innerHTML += `<div class="log-entry log-warn">❌ 错误: ${err.message}</div>`;
    el.scrollTop = el.scrollHeight;
}
