import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import dbConfig from '../config/dbConfig';

const ROOT = path.resolve(__dirname, '../../data/one-click-transfer');
const TEMPLATE_DIR = path.join(ROOT, 'templates');
const TASK_DIR = path.join(ROOT, 'tasks');
for (const dir of [TEMPLATE_DIR, TASK_DIR]) fs.mkdirSync(dir, { recursive: true });

type Row = any[];
const PREVIEW_COLUMNS = ['仪器名称', '型号规格', '制造厂', '出厂编号', '管理编号', '测量范围'];
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const safeName = (value: string) => String(value || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || '未命名';
const isLegacyBusinessType = (value: unknown) => ['现场', '送检'].includes(String(value || '').trim());
const templateGroup = (input: any, fallback: string) => String(input.templateGroupName || input.template_group_name || fallback).trim();
const templateItem = (input: any, fallback = '') => String(input.templateItemName || input.template_item_name || input.templateName || input.name || input.template_name || fallback).trim();
const splitMatchKeywords = (value: unknown) => [...new Set(
  String(value || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean),
)];
const parseJson = <T>(value: string | null | undefined, fallback: T): T => { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
// "检定日期" was used by earlier mapping screens. Treat it as the same
// start-processing value as "校准日期" so existing mappings keep working.
const normalizeForcedKey = (value: unknown) => {
  const key = String(value || '').trim();
  return key === '检定日期' ? '校准日期' : key;
};

function colToIndex(value: string): number { let n = 0; for (const c of value.toUpperCase()) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; }
function cellToAddress(cell: string): { r: number; c: number } { const match = String(cell).toUpperCase().match(/^([A-Z]+)(\d+)$/); if (!match) throw new Error(`鏃犳晥鍗曞厓鏍煎湴鍧€: ${cell}`); return { c: colToIndex(match[1]), r: Number(match[2]) - 1 }; }
function readRows(filePath: string, headerRow: number, dataStartRow: number) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, defval: '' });
  const header = (rows[Math.max(0, headerRow - 1)] || []).map((item) => String(item ?? '').trim());
  const start = Math.max(0, dataStartRow - 1);
  // Excel's used range often includes hundreds of formatted-but-empty rows.
  // Keep real records and tolerate short gaps, then stop after ten empty rows.
  const data: Row[] = [];
  let emptyRows = 0;
  for (let index = start; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const hasValue = row.some((value) => String(value ?? '').trim() !== '');
    if (hasValue) {
      data.push(row);
      emptyRows = 0;
    } else {
      emptyRows += 1;
      if (emptyRows >= 10) break;
    }
  }
  return { workbook, sheet, rows, header, data };
}

type HeaderCacheEntry = { mtimeMs: number; size: number; header: string[] };
const headerCache = new Map<string, HeaderCacheEntry>();

function readHeader(filePath: string, headerRow: number, dataStartRow: number): string[] {
  try {
    const stat = fs.statSync(filePath);
    const cached = headerCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.header;
    const header = readRows(filePath, headerRow, dataStartRow).header.filter(Boolean);
    headerCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, header });
    return header;
  } catch {
    headerCache.delete(filePath);
    return [];
  }
}

function setCellValue(sheet: XLSX.WorkSheet, row: number, column: number, value: any) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const existing = sheet[address] || {};
  // Keep the original cell style, number format, comments and hyperlinks.
  existing.v = value ?? '';
  existing.t = typeof value === 'number' ? 'n' : 's';
  sheet[address] = existing;
}

// Update only cell text in the original XLSX package. Rebuilding a workbook with
// xlsx would discard template formatting, merges, dimensions and print settings.
function xmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function richText(value: unknown): string {
  const characters = Array.from(String(value ?? ''));
  if (!characters.length) return '<is><t></t></is>';

  const runs: Array<{ chinese: boolean; text: string }> = [];
  for (const character of characters) {
    const chinese = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef\uf900-\ufaff]/.test(character);
    const previous = runs[runs.length - 1];
    if (previous && previous.chinese === chinese) previous.text += character;
    else runs.push({ chinese, text: character });
  }

  return `<is>${runs.map(({ chinese, text }) => {
    const font = chinese ? '宋体' : 'Times New Roman';
    const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
    return `<r><rPr><rFont val="${font}"/><sz val="10"/></rPr><t${preserve}>${xmlEscape(text)}</t></r>`;
  }).join('')}</is>`;
}

function createCenteredStyleManager(stylesXml: string | null) {
  if (!stylesXml) return { styleFor: (_attrs: string) => null, toXml: () => stylesXml };

  const cellXfsMatch = stylesXml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/i);
  if (!cellXfsMatch) return { styleFor: (_attrs: string) => null, toXml: () => stylesXml };

  const originalStyles = [...cellXfsMatch[2].matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/gi)].map((match) => match[0]);
  const centeredStyles = new Map<number, number>();
  const additions: string[] = [];

  const styleFor = (cellAttributes: string) => {
    const originalIndex = Number(cellAttributes.match(/\bs=["'](\d+)["']/i)?.[1] || 0);
    const existing = centeredStyles.get(originalIndex);
    if (existing !== undefined) return existing;

    const original = originalStyles[originalIndex] || originalStyles[0];
    const attributes = original?.match(/^<xf\b([^>]*?)(?:\/>|>)/i)?.[1] || '';
    const preserved = attributes
      .replace(/\s+applyAlignment=["'][^"']*["']/gi, '')
      .replace(/\s+applyProtection=["'][^"']*["']/gi, '');
    const index = originalStyles.length + additions.length;
    additions.push(`<xf${preserved} applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`);
    centeredStyles.set(originalIndex, index);
    return index;
  };

  return {
    styleFor,
    toXml: () => {
      if (!additions.length) return stylesXml;
      const openingAttributes = cellXfsMatch[1];
      const count = originalStyles.length + additions.length;
      const updatedOpening = openingAttributes.match(/\bcount=["'][^"']*["']/i)
        ? openingAttributes.replace(/\bcount=["'][^"']*["']/i, `count="${count}"`)
        : `${openingAttributes} count="${count}"`;
      return stylesXml.replace(cellXfsMatch[0], `<cellXfs${updatedOpening}>${cellXfsMatch[2]}${additions.join('')}</cellXfs>`);
    },
  };
}

function withStyle(attributes: string, styleIndex: number | null): string {
  if (styleIndex === null) return attributes;
  const withoutStyle = attributes.replace(/\s+s=["'][^"']*["']/i, '');
  return `${withoutStyle} s="${styleIndex}"`;
}

export async function writeTemplateText(templatePath: string, outputPath: string, updates: Map<string, unknown>) {
  const zip = await JSZip.loadAsync(await fs.promises.readFile(templatePath));
  const workbookFile = zip.file('xl/workbook.xml');
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (workbookFile && relsFile) {
    const workbookXml = await workbookFile.async('string');
    const relsXml = await relsFile.async('string');
    const relationId = workbookXml.match(/<sheet\b[^>]*\br:id=["']([^"']+)["']/i)?.[1];
    const relation = relationId && relsXml.match(new RegExp(`<Relationship\\b[^>]*\\bId=["']${relationId}["'][^>]*\\bTarget=["']([^"']+)["']`, 'i'));
    if (relation?.[1]) sheetPath = `xl/${relation[1].replace(/^\//, '').replace(/^xl\//, '')}`;
  }
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) throw new Error('转送模板必须是标准 .xlsx 文件，请在 Excel 中另存为“Excel 工作簿 (*.xlsx)”后重新上传');
  const stylesFile = zip.file('xl/styles.xml');
  const styleManager = createCenteredStyleManager(stylesFile ? await stylesFile.async('string') : null);
  let xml = await sheetFile.async('string');
  for (const [address, value] of updates) {
    const text = richText(value);
    const selfClosingPattern = new RegExp(`<c([^>]*\\br=["']${address}["'][^>]*?)\\s*/>`, 'i');
    const normalPattern = new RegExp(`<c([^>]*\\br=["']${address}["'][^>]*)>([^<]*(?:<(?!/?c\\b)[\\s\\S]*?)?)</c>`, 'i');
    const selfClosingMatch = xml.match(selfClosingPattern);
    const normalMatch = selfClosingMatch ? null : xml.match(normalPattern);
    if (selfClosingMatch || normalMatch) {
      const attrs = (selfClosingMatch?.[1] || normalMatch?.[1] || '').replace(/\s+t=["'][^"']*["']/i, '');
      const replacement = `<c${withStyle(attrs, styleManager.styleFor(attrs))} t="inlineStr">${text}</c>`;
      xml = xml.replace(selfClosingMatch ? selfClosingPattern : normalPattern, replacement);
      continue;
    }
    const rowNumber = Number(address.match(/\d+$/)?.[0] || 0);
    const cell = `<c r="${address}"${withStyle('', styleManager.styleFor(''))} t="inlineStr">${text}</c>`;
    const rowPattern = new RegExp(`<row([^>]*\\br=["']${rowNumber}["'][^>]*)>([\\s\\S]*?)</row>`, 'i');
    if (rowPattern.test(xml)) {
      xml = xml.replace(rowPattern, (_all, attrs, body) => {
        const targetColumn = colToIndex(address.replace(/\d+$/, ''));
        const cells = [...String(body).matchAll(/<c\b[^>]*\br=["']([A-Z]+)\d+["'][^>]*(?:\/>|>[\s\S]*?<\/c>)/gi)];
        const nextCell = cells.find((item) => colToIndex(item[1]) > targetColumn);
        const nextIndex = nextCell?.index;
        const nextBody = nextIndex === undefined
          ? `${body}${cell}`
          : `${body.slice(0, nextIndex)}${cell}${body.slice(nextIndex)}`;
        return `<row${attrs}>${nextBody}</row>`;
      });
    }
    else xml = xml.replace('</sheetData>', `<row r="${rowNumber}">${cell}</row></sheetData>`);
  }
  zip.file(sheetPath, xml);
  const styledXml = styleManager.toXml();
  if (styledXml) zip.file('xl/styles.xml', styledXml);
  await fs.promises.writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

function mergedAnchor(sheet: XLSX.WorkSheet, row: number, column: number) {
  const merge = (sheet['!merges'] || []).find((item: any) => row >= item.s.r && row <= item.e.r && column >= item.s.c && column <= item.e.c);
  return merge ? merge.s : { r: row, c: column };
}

function crc32(buffer: Buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
async function zipBuffers(entries: Array<{ name: string; data: Buffer }>) {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.data);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  /* legacy implementation retained below for reference */
  /*
  const local: Buffer[] = []; const central: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8'); const compressed = zlib.deflateRawSync(entry.data); const crc = crc32(entry.data);
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(8, 8); head.writeUInt32LE(crc, 14); head.writeUInt32LE(compressed.length, 18); head.writeUInt32LE(entry.data.length, 22); head.writeUInt16LE(name.length, 26);
    local.push(head, name, compressed);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(8, 10); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(compressed.length, 20); dir.writeUInt32LE(entry.data.length, 24); dir.writeUInt16LE(name.length, 28); dir.writeUInt32LE(offset, 42); central.push(dir, name); offset += head.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...local, ...central, end]); */
}

class OneClickTransferService {
  private get db() { return dbConfig.getConnection(); }

  /** Use source-specific mappings as an override of global mappings. */
  private async getTargetMappings(targetTemplateId: string, sourceTemplateId: string) {
    const specific = await this.db.all<any[]>(
      'SELECT * FROM transfer_mappings WHERE target_template_id = ? AND upload_template_id = ? ORDER BY rowid',
      [targetTemplateId, sourceTemplateId],
    );
    if (specific.length) return specific;
    return this.db.all<any[]>(
      'SELECT * FROM transfer_mappings WHERE target_template_id = ? AND upload_template_id IS NULL ORDER BY rowid',
      [targetTemplateId],
    );
  }

  private validateForcedMappings(book: any, mappings: any[]) {
    for (const mapping of mappings.filter((item) => item.forced_key)) {
      if (mapping.target_cell) {
        cellToAddress(mapping.target_cell);
        continue;
      }
      const targetColumn = String(mapping.target_column || mapping.forced_key || '').trim();
      if (!targetColumn || book.header.indexOf(targetColumn) < 0) {
        throw new Error(`强制字段“${mapping.forced_key}”未配置有效目标列或单元格`);
      }
    }
  }

  private async rebuildPreviewRows(file: any): Promise<Record<string, unknown>[]> {
    try {
      if (!file.file_path || !fs.existsSync(file.file_path)) return [];
      const target = await this.db.get<any>('SELECT header_row,data_start_row FROM transfer_target_templates WHERE id = ?', [file.target_template_id]);
      const generated = readRows(file.file_path, Number(target?.header_row || 1), Number(target?.data_start_row || 2));
      const mappings = await this.db.all<any[]>('SELECT source_column,target_column FROM transfer_mappings WHERE target_template_id = ? AND (forced_key IS NULL OR forced_key = \'\')', [file.target_template_id]);

      return generated.data.slice(0, Number(file.row_count || generated.data.length)).map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => {
        const targetColumn = mappings.find((mapping) => mapping.source_column === column)?.target_column || column;
        const targetIndex = generated.header.indexOf(targetColumn);
        return [column, targetIndex >= 0 ? row[targetIndex] ?? '' : ''];
      })));
    } catch {
      return [];
    }
  }

  async saveUploadTemplateWithFile(input: any, file?: Express.Multer.File) {
    const timestamp = now();
    const groupName = '收发委托模板组';
    const itemName = templateItem(input);
    if (!itemName) throw new Error('模板项名称不能为空');
    const existing = await this.db.get<any>('SELECT id,file_path,file_name FROM transfer_upload_templates WHERE id=? OR template_item_name=? OR template_name=? OR type_name=?', [input.id || '', itemName, itemName, itemName]);
    const templateId = input.id || existing?.id || id('upload');
    let filePath = existing?.file_path;
    let fileName = existing?.file_name;
    if (file) {
      if (!/\.(xlsx|xls)$/i.test(file.originalname)) throw new Error('浠呮敮鎸亁lsx鎴杧ls鏂囦欢');
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      fileName = decodedName.includes('\ufffd') ? file.originalname : decodedName;
      filePath = path.join(TEMPLATE_DIR, `${templateId}-${safeName(fileName)}`);
      await fs.promises.writeFile(filePath, file.buffer);
    }
    if (!filePath) throw new Error('璇蜂笂浼犲緟涓婁紶妯℃澘Excel鏂囦欢');
    const header = readRows(filePath, Number(input.headerRow || 1), Number(input.dataStartRow || 2)).header;
    const matchColumnEnabled = String(input.matchColumnEnabled ?? 'true') !== 'false' ? 1 : 0;
    if (matchColumnEnabled && (!input.matchColumn || !header.includes(input.matchColumn))) throw new Error('匹配规则列不存在');
    await this.db.run(`INSERT INTO transfer_upload_templates(id,type_name,template_name,template_group_name,template_item_name,file_path,file_name,match_column,match_column_enabled,header_row,data_start_row,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type_name=excluded.type_name,template_name=excluded.template_name,template_group_name=excluded.template_group_name,template_item_name=excluded.template_item_name,file_path=excluded.file_path,file_name=excluded.file_name,match_column=excluded.match_column,match_column_enabled=excluded.match_column_enabled,header_row=excluded.header_row,data_start_row=excluded.data_start_row,updated_at=excluded.updated_at`, [templateId, `${groupName}/${itemName}`, itemName, groupName, itemName, filePath, fileName, matchColumnEnabled ? input.matchColumn : null, matchColumnEnabled, Number(input.headerRow || 1), Number(input.dataStartRow || 2), timestamp, timestamp]);
    return { id: templateId, fileName };
  }

  async saveImportTemplateWithFile(input: any, file?: Express.Multer.File) {
    const timestamp = now();
    const groupName = '导入格式模板组';
    const itemName = templateItem(input);
    if (!itemName) throw new Error('模板项名称不能为空');
    const existing = await this.db.get<any>('SELECT id,file_path,file_name FROM transfer_import_templates WHERE id=? OR template_item_name=? OR name=?', [input.id || '', itemName, itemName]);
    const templateId = input.id || existing?.id || id('import');
    let filePath = existing?.file_path;
    let fileName = existing?.file_name;
    if (file) {
      if (!/\.(xlsx|xls)$/i.test(file.originalname)) throw new Error('导入格式仅支持 xlsx 或 xls 文件');
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      fileName = decodedName.includes('\ufffd') ? file.originalname : decodedName;
      filePath = path.join(TEMPLATE_DIR, `${templateId}-${safeName(fileName)}`);
      await fs.promises.writeFile(filePath, file.buffer);
    }
    if (!filePath) throw new Error('请上传导入格式 Excel 文件');
    readRows(filePath, Number(input.headerRow || 1), Number(input.dataStartRow || 2));
    const header = readRows(filePath, Number(input.headerRow || 1), Number(input.dataStartRow || 2)).header;
    const matchColumnEnabled = String(input.matchColumnEnabled ?? 'true') !== 'false' ? 1 : 0;
    if (matchColumnEnabled && (!input.matchColumn || !header.includes(input.matchColumn))) throw new Error('导入格式的匹配列不存在');
    await this.db.run(`INSERT INTO transfer_import_templates(id,name,template_group_name,template_item_name,file_path,file_name,match_column,match_column_enabled,header_row,data_start_row,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,template_group_name=excluded.template_group_name,template_item_name=excluded.template_item_name,file_path=excluded.file_path,file_name=excluded.file_name,match_column=excluded.match_column,match_column_enabled=excluded.match_column_enabled,header_row=excluded.header_row,data_start_row=excluded.data_start_row,updated_at=excluded.updated_at`, [templateId, itemName, groupName, itemName, filePath, fileName, matchColumnEnabled ? input.matchColumn : null, matchColumnEnabled, Number(input.headerRow || 1), Number(input.dataStartRow || 2), timestamp, timestamp]);
    return { id: templateId, fileName };
  }

  async saveQuoteTemplateWithFile(input: any, file?: Express.Multer.File) {
    const timestamp = now();
    const groupName = '报价单模板组';
    const itemName = templateItem(input);
    if (!itemName) throw new Error('模板项名称不能为空');
    const existing = await this.db.get<any>('SELECT id,file_path,file_name FROM transfer_quote_templates WHERE id=? OR template_item_name=? OR name=?', [input.id || '', itemName, itemName]);
    const templateId = input.id || existing?.id || id('quote');
    let filePath = existing?.file_path;
    let fileName = existing?.file_name;
    if (file) {
      if (!/\.(xlsx|xls)$/i.test(file.originalname)) throw new Error('报价单模板仅支持 xlsx 或 xls 文件');
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      fileName = decodedName.includes('\ufffd') ? file.originalname : decodedName;
      filePath = path.join(TEMPLATE_DIR, `${templateId}-${safeName(fileName)}`);
      await fs.promises.writeFile(filePath, file.buffer);
    }
    if (!filePath) throw new Error('请上传报价单模板文件');
    readRows(filePath, Number(input.headerRow || 1), Number(input.dataStartRow || 2));
    await this.db.run(`INSERT INTO transfer_quote_templates(id,name,template_group_name,template_item_name,file_path,file_name,header_row,data_start_row,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,template_group_name=excluded.template_group_name,template_item_name=excluded.template_item_name,file_path=excluded.file_path,file_name=excluded.file_name,header_row=excluded.header_row,data_start_row=excluded.data_start_row,updated_at=excluded.updated_at`, [templateId, itemName, groupName, itemName, filePath, fileName, Number(input.headerRow || 1), Number(input.dataStartRow || 2), timestamp, timestamp]);
    return { id: templateId, fileName };
  }

  async getConfig() {
    const [uploadTemplates, importTemplates, quoteTemplates, targetTemplates, settings] = await Promise.all([
      this.db.all('SELECT * FROM transfer_upload_templates ORDER BY template_group_name, template_item_name'),
      this.db.all('SELECT * FROM transfer_import_templates ORDER BY template_group_name, template_item_name'),
      this.db.all('SELECT * FROM transfer_quote_templates ORDER BY template_group_name, template_item_name'),
      this.db.all('SELECT * FROM transfer_target_templates ORDER BY template_group_name, template_item_name'),
      this.db.all('SELECT * FROM transfer_settings ORDER BY key'),
    ]);
    const headersFor = (item: any) => {
      if (!item.file_path || !fs.existsSync(item.file_path)) return [];
      return readHeader(item.file_path, item.header_row, item.data_start_row);
    };
    const uploads = (uploadTemplates as any[]).filter((item) => !isLegacyBusinessType(item.template_item_name || item.template_name || item.type_name)).map((item) => ({ ...item, template_group_name: '收发委托模板组', template_item_name: item.template_item_name || item.template_name || item.type_name, template_name: item.template_item_name || item.template_name || item.type_name, headers: headersFor(item) }));
    const imports = (importTemplates as any[]).map((item) => ({ ...item, template_group_name: '导入格式模板组', template_item_name: item.template_item_name || item.name, name: item.template_item_name || item.name, headers: headersFor(item) }));
    const quotes = (quoteTemplates as any[]).map((item) => ({ ...item, template_group_name: '报价单模板组', template_item_name: item.template_item_name || item.name, name: item.template_item_name || item.name, headers: headersFor(item) }));
    const targets = (targetTemplates as any[]).filter((item) => !isLegacyBusinessType(item.template_item_name || item.name) && !isLegacyBusinessType(item.match_keyword)).map((item) => ({ ...item, template_group_name: '转送对象模板组', template_item_name: item.template_item_name || item.name, name: item.template_item_name || item.name, file_name: item.file_path ? path.basename(item.file_path) : '', headers: headersFor(item), mappings: [] }));
    const mappingRows = await this.db.all<any[]>('SELECT * FROM transfer_mappings ORDER BY target_template_id, rowid');
    const mappingsByTarget = new Map<string, any[]>();
    for (const row of mappingRows) {
      const rows = mappingsByTarget.get(row.target_template_id) || [];
      rows.push(row);
      mappingsByTarget.set(row.target_template_id, rows);
    }
    for (const target of targets) {
      target.mappings = (mappingsByTarget.get(target.id) || []).map((row) => ({ ...row, sourceColumn: row.source_column || '', targetColumn: row.target_column || '', forcedKey: row.forced_key || undefined, targetCell: row.target_cell || '' }));
    }
    const importMappings = await this.db.all<any[]>('SELECT * FROM transfer_import_mappings ORDER BY rowid');
    const quoteMappings = await this.db.all<any[]>('SELECT * FROM transfer_quote_mappings ORDER BY rowid');
    const quoteOrderMappings = await this.db.all<any[]>('SELECT * FROM transfer_quote_order_mappings ORDER BY rowid');
    const normalizeMapping = (row: any) => ({ ...row, sourceColumn: row.source_column || '', targetColumn: row.target_column || '', forcedKey: row.forced_key || undefined, targetCell: row.target_cell || '' });
    return { uploadTemplates: uploads, orderTemplates: uploads, importTemplates: imports, quoteTemplates: quotes, importMappings: importMappings.map(normalizeMapping), quoteMappings: quoteMappings.map(normalizeMapping), quoteOrderMappings: quoteOrderMappings.map(normalizeMapping), targetTemplates: targets, settings: Object.fromEntries((settings as any[]).map((item) => [item.key, parseJson(item.value, item.value)])) };
  }

  async saveImportMappings(importTemplateId: string, orderTemplateId: string, mappings: any[]) {
    const importTemplate = await this.db.get<any>('SELECT id FROM transfer_import_templates WHERE id = ?', [importTemplateId]);
    const orderTemplate = await this.db.get<any>('SELECT id FROM transfer_upload_templates WHERE id = ?', [orderTemplateId]);
    if (!importTemplate || !orderTemplate) throw new Error('导入格式或收发委托单模板不存在');
    await this.db.run('DELETE FROM transfer_import_mappings WHERE import_template_id = ? AND order_template_id = ?', [importTemplateId, orderTemplateId]);
    const timestamp = now();
    for (const mapping of mappings || []) await this.db.run('INSERT INTO transfer_import_mappings(id,import_template_id,order_template_id,source_column,target_column,forced_key,target_cell,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [id('import-mapping'), importTemplateId, orderTemplateId, mapping.sourceColumn || null, mapping.targetColumn || null, mapping.forcedKey || null, mapping.targetCell || null, timestamp, timestamp]);
    return { importTemplateId, orderTemplateId };
  }

  async saveQuoteMappings(quoteTemplateId: string, importTemplateId: string, mappings: any[]) {
    const quote = await this.db.get<any>('SELECT id FROM transfer_quote_templates WHERE id = ?', [quoteTemplateId]);
    const importTemplate = await this.db.get<any>('SELECT id FROM transfer_import_templates WHERE id = ?', [importTemplateId]);
    if (!quote || !importTemplate) throw new Error('报价单或导入格式模板不存在');
    await this.db.run('DELETE FROM transfer_quote_mappings WHERE quote_template_id = ? AND import_template_id = ?', [quoteTemplateId, importTemplateId]);
    const timestamp = now();
    for (const mapping of mappings || []) await this.db.run('INSERT INTO transfer_quote_mappings(id,quote_template_id,import_template_id,source_column,target_column,forced_key,target_cell,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [id('quote-mapping'), quoteTemplateId, importTemplateId, mapping.sourceColumn || null, mapping.targetColumn || null, mapping.forcedKey || null, mapping.targetCell || null, timestamp, timestamp]);
    return { quoteTemplateId, importTemplateId };
  }

  async saveQuoteOrderMappings(quoteTemplateId: string, orderTemplateId: string, mappings: any[]) {
    const quote = await this.db.get<any>('SELECT id FROM transfer_quote_templates WHERE id = ?', [quoteTemplateId]);
    const orderTemplate = await this.db.get<any>('SELECT id FROM transfer_upload_templates WHERE id = ?', [orderTemplateId]);
    if (!quote || !orderTemplate) throw new Error('报价单或收发委托单模板不存在');
    await this.db.run('DELETE FROM transfer_quote_order_mappings WHERE quote_template_id = ? AND order_template_id = ?', [quoteTemplateId, orderTemplateId]);
    const timestamp = now();
    for (const mapping of mappings || []) await this.db.run('INSERT INTO transfer_quote_order_mappings(id,quote_template_id,order_template_id,source_column,target_column,forced_key,target_cell,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [id('quote-order-mapping'), quoteTemplateId, orderTemplateId, mapping.sourceColumn || null, mapping.targetColumn || null, mapping.forcedKey || null, mapping.targetCell || null, timestamp, timestamp]);
    return { quoteTemplateId, orderTemplateId };
  }

  async suggestQuoteMappings(quoteTemplateId: string, importTemplateId: string) {
    const quote = await this.db.get<any>('SELECT * FROM transfer_quote_templates WHERE id = ?', [quoteTemplateId]);
    const importTemplate = await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [importTemplateId]);
    if (!quote || !importTemplate) throw new Error('报价单或导入格式模板不存在');
    const headers = (item: any) => item.file_path && fs.existsSync(item.file_path) ? readRows(item.file_path, item.header_row, item.data_start_row).header.filter(Boolean) : [];
    const source = headers(quote); const destination = headers(importTemplate);
    const normalize = (value: string) => String(value).toLowerCase().replace(/[ _\-（）()\[\]【】]/g, '').replace(/日期/g, '时间');
    const score = (a: string, b: string) => { const x = normalize(a); const y = normalize(b); if (x === y) return 1; if (x.includes(y) || y.includes(x)) return 0.86; const common = Array.from(new Set(x.split(''))).filter((c) => y.includes(c)).length; return common / Math.max(x.length, y.length, 1); };
    const used = new Set<string>();
    return source.map((sourceColumn) => { const candidates = destination.map((targetColumn) => ({ targetColumn, score: score(sourceColumn, targetColumn) })).filter((item) => !used.has(item.targetColumn)).sort((a, b) => b.score - a.score); const best = candidates[0]; if (best && best.score >= 0.45) used.add(best.targetColumn); return { sourceColumn, targetColumn: best && best.score >= 0.45 ? best.targetColumn : '', confidence: best ? Number(best.score.toFixed(2)) : 0, status: best && best.score >= 0.75 ? 'suggested' : 'review' }; });
  }

  async suggestQuoteOrderMappings(quoteTemplateId: string, orderTemplateId: string) {
    const quote = await this.db.get<any>('SELECT * FROM transfer_quote_templates WHERE id = ?', [quoteTemplateId]);
    const orderTemplate = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [orderTemplateId]);
    if (!quote || !orderTemplate) throw new Error('报价单或收发委托单模板不存在');
    const headers = (item: any) => item.file_path && fs.existsSync(item.file_path) ? readRows(item.file_path, item.header_row, item.data_start_row).header.filter(Boolean) : [];
    const source = headers(quote); const destination = headers(orderTemplate);
    const normalize = (value: string) => String(value).toLowerCase().replace(/[ _\-（）()\[\]【】]/g, '').replace(/日期/g, '时间');
    const score = (a: string, b: string) => { const x = normalize(a); const y = normalize(b); if (x === y) return 1; if (x.includes(y) || y.includes(x)) return 0.86; const common = Array.from(new Set(x.split(''))).filter((c) => y.includes(c)).length; return common / Math.max(x.length, y.length, 1); };
    const used = new Set<string>();
    return source.map((sourceColumn) => { const candidates = destination.map((targetColumn) => ({ targetColumn, score: score(sourceColumn, targetColumn) })).filter((item) => !used.has(item.targetColumn)).sort((a, b) => b.score - a.score); const best = candidates[0]; if (best && best.score >= 0.45) used.add(best.targetColumn); return { sourceColumn, targetColumn: best && best.score >= 0.45 ? best.targetColumn : '', confidence: best ? Number(best.score.toFixed(2)) : 0, status: best && best.score >= 0.75 ? 'suggested' : 'review' }; });
  }

  async suggestImportMappings(importTemplateId: string, orderTemplateId: string) {
    const importTemplate = await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [importTemplateId]);
    const orderTemplate = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [orderTemplateId]);
    if (!importTemplate || !orderTemplate) throw new Error('导入格式或收发委托单模板不存在');
    const headers = (item: any) => item.file_path && fs.existsSync(item.file_path) ? readRows(item.file_path, item.header_row, item.data_start_row).header.filter(Boolean) : [];
    const source = headers(importTemplate); const destination = headers(orderTemplate);
    const normalize = (value: string) => String(value).toLowerCase().replace(/[ _\-（）()\[\]【】]/g, '').replace(/日期/g, '时间');
    const score = (a: string, b: string) => { const x = normalize(a); const y = normalize(b); if (x === y) return 1; if (x.includes(y) || y.includes(x)) return 0.86; const common = Array.from(new Set(x.split(''))).filter((c) => y.includes(c)).length; return common / Math.max(x.length, y.length, 1); };
    const used = new Set<string>();
    return source.map((sourceColumn) => {
      const candidates = destination.map((targetColumn) => ({ targetColumn, score: score(sourceColumn, targetColumn) })).filter((item) => !used.has(item.targetColumn)).sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (best && best.score >= 0.45) used.add(best.targetColumn);
      return { sourceColumn, targetColumn: best && best.score >= 0.45 ? best.targetColumn : '', confidence: best ? Number(best.score.toFixed(2)) : 0, status: best && best.score >= 0.75 ? 'suggested' : 'review' };
    });
  }

  async saveUploadTemplate(input: any) { const timestamp = now(); const groupName = '收发委托模板组'; const itemName = templateItem(input, input.typeName); if (!itemName) throw new Error('模板项名称不能为空'); const templateId = input.id || id('upload'); await this.db.run(`INSERT INTO transfer_upload_templates(id,type_name,template_name,template_group_name,template_item_name,header_row,data_start_row,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET type_name=excluded.type_name,template_name=excluded.template_name,template_group_name=excluded.template_group_name,template_item_name=excluded.template_item_name,header_row=excluded.header_row,data_start_row=excluded.data_start_row,updated_at=excluded.updated_at`, [templateId, `${groupName}/${itemName}`, itemName, groupName, itemName, Number(input.headerRow || 1), Number(input.dataStartRow || 2), timestamp, timestamp]); return { id: templateId }; }
  async saveTargetTemplate(input: any, file?: Express.Multer.File) {
    const timestamp = now();
    const templateId = input.id || id('target');
    const matchKeywords = splitMatchKeywords(input.matchKeyword);
    if (!matchKeywords.length) throw new Error('请至少填写一个匹配关键字');

    // Keep the file owned by this template. Do not trust a client-provided
    // path, since it can make different target templates point at one Excel.
    const existing = await this.db.get<any>('SELECT file_path FROM transfer_target_templates WHERE id = ?', [templateId]);
    let filePath = existing?.file_path;
    if (file) {
      if (!/\.xlsx$/i.test(file.originalname)) throw new Error('转送模板必须使用 .xlsx 格式，请在 Excel 中另存为“Excel 工作簿 (*.xlsx)”');
      const filename = `${templateId}-${safeName(file.originalname)}`;
      filePath = path.join(TEMPLATE_DIR, filename);
      await fs.promises.writeFile(filePath, file.buffer);
    }

    if (!filePath) throw new Error('模板文件不能为空');
    const groupName = '转送对象模板组';
    const itemName = templateItem(input);
    if (!itemName) throw new Error('模板项名称不能为空');
    await this.db.run(
      `INSERT INTO transfer_target_templates(id,name,template_group_name,template_item_name,match_keyword,file_path,header_row,data_start_row,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,template_group_name=excluded.template_group_name,template_item_name=excluded.template_item_name,match_keyword=excluded.match_keyword,file_path=excluded.file_path,header_row=excluded.header_row,data_start_row=excluded.data_start_row,updated_at=excluded.updated_at`,
      [templateId, itemName, groupName, itemName, matchKeywords.join(','), filePath, Number(input.headerRow || 1), Number(input.dataStartRow || 2), timestamp, timestamp],
    );
    return { id: templateId };
  }
  async saveMappings(targetTemplateId: string, mappings: any[], uploadTemplateId?: string) {
    await this.db.run('DELETE FROM transfer_mappings WHERE target_template_id = ? AND (upload_template_id = ? OR (? IS NULL AND upload_template_id IS NULL))', [targetTemplateId, uploadTemplateId || null, uploadTemplateId || null]);
    const timestamp = now();
    for (const mapping of mappings || []) await this.db.run('INSERT INTO transfer_mappings(id,target_template_id,upload_template_id,source_column,target_column,forced_key,target_cell,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', [id('mapping'), targetTemplateId, uploadTemplateId || null, mapping.sourceColumn || null, mapping.targetColumn || null, mapping.forcedKey || null, mapping.targetCell || null, timestamp, timestamp]);
    return { targetTemplateId, uploadTemplateId: uploadTemplateId || null };
  }

  async suggestMappings(uploadTemplateId: string, targetTemplateId: string) {
    const upload = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [uploadTemplateId])
      || await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [uploadTemplateId]);
    const target = await this.db.get<any>('SELECT * FROM transfer_target_templates WHERE id = ?', [targetTemplateId]);
    if (!upload || !target) throw new Error('模板不存在');
    const headers = (item: any) => item.file_path && fs.existsSync(item.file_path) ? readRows(item.file_path, item.header_row, item.data_start_row).header.filter(Boolean) : [];
    const source = headers(upload); const destination = headers(target);
    const normalize = (value: string) => String(value).toLowerCase().replace(/[ _\-（）()\[\]【】]/g, '').replace(/日期/g, '时间');
    const score = (a: string, b: string) => { const x = normalize(a); const y = normalize(b); if (x === y) return 1; if (x.includes(y) || y.includes(x)) return 0.86; const common = Array.from(new Set(x.split(''))).filter((c) => y.includes(c)).length; return common / Math.max(x.length, y.length, 1); };
    const used = new Set<string>();
    return source.map((sourceColumn) => { const candidates = destination.map((targetColumn) => ({ targetColumn, score: score(sourceColumn, targetColumn) })).filter((item) => !used.has(item.targetColumn)).sort((a, b) => b.score - a.score); const best = candidates[0]; if (best && best.score >= 0.45) used.add(best.targetColumn); return { sourceColumn, targetColumn: best && best.score >= 0.45 ? best.targetColumn : '', confidence: best ? Number(best.score.toFixed(2)) : 0, status: best && best.score >= 0.75 ? 'suggested' : 'review' }; });
  }
  async deleteTargetTemplate(templateId: string) { await this.db.run('DELETE FROM transfer_target_templates WHERE id = ?', [templateId]); }
  async deleteUploadTemplate(templateId: string) {
    const template = await this.db.get<any>('SELECT file_path FROM transfer_upload_templates WHERE id=?', [templateId]);
    await this.db.run('DELETE FROM transfer_upload_templates WHERE id = ?', [templateId]);
    if (template?.file_path) await fs.promises.rm(template.file_path, { force: true });
  }
  async deleteImportTemplate(templateId: string) {
    const template = await this.db.get<any>('SELECT file_path FROM transfer_import_templates WHERE id=?', [templateId]);
    await this.db.run('DELETE FROM transfer_import_templates WHERE id = ?', [templateId]);
    if (template?.file_path) await fs.promises.rm(template.file_path, { force: true });
  }
  async deleteQuoteTemplate(templateId: string) {
    const template = await this.db.get<any>('SELECT file_path FROM transfer_quote_templates WHERE id=?', [templateId]);
    await this.db.run('DELETE FROM transfer_quote_templates WHERE id = ?', [templateId]);
    if (template?.file_path) await fs.promises.rm(template.file_path, { force: true });
  }

  private async processQuote(input: any, file: Express.Multer.File, username = '') {
    const certificateUnit = String(input?.certificateUnit ?? '').trim();
    const certificateAddress = String(input?.certificateAddress ?? '').trim();
    const calibrationDate = String(input?.calibrationDate ?? '').trim();
    if (!certificateUnit || !certificateAddress || !calibrationDate) throw new Error('证书名称、证书地址和校准日期不能为空');
    const generationMode = String(input.generationMode || 'import');
    const quote = await this.db.get<any>('SELECT * FROM transfer_quote_templates WHERE id = ?', [String(input.quoteTemplateId || '')]);
    const importTemplate = await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [String(input.importTemplateId || '')]);
    const orderTemplate = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [String(input.orderTemplateId || '')]);
    if (!quote || !quote.file_path || !fs.existsSync(quote.file_path)) throw new Error('未配置有效的报价单模板');
    if (generationMode !== 'import') {
      if (!orderTemplate || !orderTemplate.file_path || !fs.existsSync(orderTemplate.file_path)) throw new Error('未配置有效的收发委托单模板');
      return this.processTwoStage({ ...input, sourceTemplateType: 'quote', quoteTemplateId: quote.id, orderTemplateId: orderTemplate.id, sourceFilename: file.originalname, generationMode: generationMode === 'order' ? 'order' : 'all' }, file, username);
    }
    if (!importTemplate || !importTemplate.file_path || !fs.existsSync(importTemplate.file_path)) throw new Error('未配置有效的导入格式模板');
    const mappings = await this.db.all<any[]>('SELECT * FROM transfer_quote_mappings WHERE quote_template_id = ? AND import_template_id = ? ORDER BY rowid', [quote.id, importTemplate.id]);
    if (!mappings.length) throw new Error('尚未配置报价单到导入格式的映射关系');
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (decodedName && !decodedName.includes('\ufffd')) file.originalname = decodedName;
    const sourcePath = path.join(TASK_DIR, `${id('quote-source')}-${safeName(file.originalname)}`);
    const generatedPath = path.join(TASK_DIR, `${id('generated-import')}-${safeName(importTemplate.file_name || '导入格式.xlsx')}`);
    try {
      await fs.promises.writeFile(sourcePath, file.buffer);
      const source = readRows(sourcePath, quote.header_row, quote.data_start_row);
      const importBook = readRows(importTemplate.file_path, importTemplate.header_row, importTemplate.data_start_row);
      this.validateForcedMappings(importBook, mappings);
      const missingSource = mappings.filter((item) => !item.forced_key && item.source_column && source.header.indexOf(item.source_column) < 0).map((item) => item.source_column);
      const missingTarget = mappings.filter((item) => (item.target_column || item.target_cell) && !item.target_cell && importBook.header.indexOf(item.target_column) < 0).map((item) => item.target_column);
      if (missingSource.length || missingTarget.length) throw new Error(`映射字段不存在：${[...new Set([...missingSource, ...missingTarget])].join('、')}`);
      const forced = { '证书单位': certificateUnit, '证书地址': certificateAddress, '校准日期': calibrationDate };
      const updates = new Map<string, unknown>();
      for (const mapping of mappings.filter((item) => item.forced_key && item.target_cell)) {
        const cell = cellToAddress(mapping.target_cell); const anchor = mergedAnchor(importBook.sheet, cell.r, cell.c);
        updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? '');
      }
      const dynamicForcedColumns = mappings.filter((item) => item.forced_key && !item.target_cell).map((mapping) => ({ mapping, column: importBook.header.findIndex((header) => header === String(mapping.target_column || mapping.forced_key || '').trim()) })).filter((item) => item.column >= 0);
      for (let i = 0; i < source.data.length; i += 1) {
        const outputRow = Math.max(0, Number(importTemplate.data_start_row || 2) - 1) + i;
        for (const { mapping, column } of dynamicForcedColumns) { const anchor = mergedAnchor(importBook.sheet, outputRow, column); updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? ''); }
        const rowValues = new Map<string, unknown[]>();
        for (const mapping of mappings.filter((item) => !item.forced_key && item.source_column && item.target_column)) {
          const sourceIndex = source.header.indexOf(mapping.source_column); const targetIndex = importBook.header.indexOf(mapping.target_column);
          if (sourceIndex < 0 || targetIndex < 0) continue;
          const anchor = mergedAnchor(importBook.sheet, outputRow, targetIndex); const address = XLSX.utils.encode_cell(anchor);
          const values = rowValues.get(address) || []; values.push(source.data[i][sourceIndex] ?? ''); rowValues.set(address, values);
        }
        for (const [address, values] of rowValues) updates.set(address, values.filter((value) => String(value).trim() !== '').join('/'));
      }
      await writeTemplateText(importTemplate.file_path, generatedPath, updates);
      {
        const taskId = id('task'); const folderName = `${safeName(calibrationDate).replace(/-/g, '')}_导入格式`; const folderPath = path.join(TASK_DIR, `${taskId}-${folderName}`);
        await fs.promises.mkdir(folderPath, { recursive: true });
        const filename = `${safeName(calibrationDate).replace(/-/g, '')}_导入格式.xlsx`; const outputPath = path.join(folderPath, filename);
        await fs.promises.copyFile(generatedPath, outputPath); const size = (await fs.promises.stat(outputPath)).size;
        const generated = readRows(outputPath, importTemplate.header_row, importTemplate.data_start_row); generated.data = generated.data.slice(0, source.data.length);
        const previewRows = generated.data.map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => { const index = generated.header.indexOf(column); return [column, index >= 0 ? row[index] ?? '' : '']; })));
        const fileId = id('file');
        await this.db.run(`INSERT INTO transfer_tasks(id,user_name,certificate_unit,certificate_address,calibration_date,source_filename,business_type,match_column,status,total_rows,matched_rows,skipped_rows,folder_name,created_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [taskId, username, certificateUnit, certificateAddress, calibrationDate, file.originalname, quote.template_item_name || quote.name, importTemplate.match_column || '导入格式', 'completed', source.data.length, source.data.length, 0, folderName, now(), now()]);
        await this.db.run(`INSERT INTO transfer_files(id,task_id,target_template_id,template_name,template_group_name,template_item_name,match_keyword,filename,file_path,row_count,file_size,preview_data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [fileId, taskId, null, importTemplate.name, importTemplate.template_group_name || '导入格式模板', importTemplate.template_item_name || importTemplate.name, '导入格式', filename, outputPath, source.data.length, size, JSON.stringify(previewRows), now()]);
        return { task: { id: taskId, folderName, totalRows: source.data.length, matchedRows: source.data.length, skippedRows: 0, status: 'completed' }, files: [{ id: fileId, templateName: importTemplate.name, matchKeyword: '导入格式', filename, rowCount: source.data.length, fileSize: size, fileType: 'import' }] };
      }
    } finally {
      await fs.promises.rm(sourcePath, { force: true });
      await fs.promises.rm(generatedPath, { force: true });
    }
  }

  private async processTargetOnly(input: any, file: Express.Multer.File, username = '') {
    const certificateUnit = String(input?.certificateUnit ?? '').trim();
    const certificateAddress = String(input?.certificateAddress ?? '').trim();
    const calibrationDate = String(input?.calibrationDate ?? '').trim();
    if (!certificateUnit || !certificateAddress || !calibrationDate) throw new Error('证书名称、证书地址和校准日期不能为空');
    const sourceType = String(input.sourceType || 'order');
    const sourceTemplateId = String(input.sourceTemplateId || '');
    const sourceTemplate = sourceType === 'import'
      ? await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [sourceTemplateId])
      : await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [sourceTemplateId]);
    if (!sourceTemplate || !sourceTemplate.file_path || !fs.existsSync(sourceTemplate.file_path)) throw new Error('未配置有效的源模板');
    const matchColumn = String(sourceTemplate.match_column || '').trim();
    if (!matchColumn) throw new Error('源模板尚未配置转送匹配列');
    const active = await this.db.get(`SELECT id FROM transfer_tasks WHERE user_name = ? AND status = 'processing'`, [username]);
    if (active) throw new Error('当前已有处理中的任务，请等待完成');
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (decodedName && !decodedName.includes('\ufffd')) file.originalname = decodedName;
    const sourcePath = path.join(TASK_DIR, `${id('source')}-${safeName(file.originalname)}`);
    let taskId = '';
    let folderPath = '';
    try {
      await fs.promises.writeFile(sourcePath, file.buffer);
      const source = readRows(sourcePath, Number(sourceTemplate.header_row || 1), Number(sourceTemplate.data_start_row || 2));
      const matchIndex = source.header.indexOf(matchColumn);
      if (matchIndex < 0) throw new Error(`上传文件缺少转送匹配列：${matchColumn}`);
      const taskName = `${safeName(calibrationDate).replace(/-/g, '')}_${safeName(sourceTemplate.template_item_name || sourceTemplate.name || sourceTemplate.template_name || '转送')}`;
      taskId = id('task');
      folderPath = path.join(TASK_DIR, `${taskId}-${taskName}`);
      await fs.promises.mkdir(folderPath, { recursive: true });
      await this.db.run(`INSERT INTO transfer_tasks(id,user_name,certificate_unit,certificate_address,calibration_date,source_filename,business_type,match_column,status,total_rows,matched_rows,skipped_rows,folder_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [taskId, username, certificateUnit, certificateAddress, calibrationDate, file.originalname, sourceTemplate.template_item_name || sourceTemplate.name || sourceTemplate.template_name, matchColumn, 'processing', source.data.length, 0, 0, taskName, now()]);
      const targets = (await this.db.all<any[]>('SELECT * FROM transfer_target_templates')).filter((item) => !isLegacyBusinessType(item.name) && !isLegacyBusinessType(item.match_keyword));
      const groups = new Map<string, { rows: Row[]; matchedKeywords: Set<string> }>();
      let skipped = 0;
      for (const row of source.data) {
        const value = String(row[matchIndex] ?? '').trim();
        const target = targets.find((item) => splitMatchKeywords(item.match_keyword).includes(value));
        if (!target) { skipped += 1; continue; }
        const group = groups.get(target.id) || { rows: [], matchedKeywords: new Set<string>() };
        group.rows.push(row); group.matchedKeywords.add(value); groups.set(target.id, group);
      }
      const forced = { '证书单位': certificateUnit, '证书地址': certificateAddress, '校准日期': calibrationDate };
      const generated: any[] = [];
      for (const [targetId, group] of groups) {
        const target = targets.find((item) => item.id === targetId);
        if (!target || !fs.existsSync(target.file_path)) continue;
        const targetBook = readRows(target.file_path, target.header_row, target.data_start_row);
        const mappings = await this.getTargetMappings(targetId, sourceTemplateId);
        if (!mappings.length) throw new Error(`尚未配置“${sourceTemplate.name || sourceTemplate.template_name} → ${target.name}”的映射关系`);
        const updates = new Map<string, unknown>();
        for (const mapping of mappings.filter((item) => item.forced_key && item.target_cell)) {
          const cell = cellToAddress(mapping.target_cell); const anchor = mergedAnchor(targetBook.sheet, cell.r, cell.c);
          updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? '');
        }
        const dynamicForcedColumns = mappings.filter((item) => normalizeForcedKey(item.forced_key) === '校准日期' && !item.target_cell).map((mapping) => ({ mapping, column: targetBook.header.findIndex((header) => header === String(mapping.target_column || mapping.forced_key || '').trim()) })).filter((item) => item.column >= 0);
        for (let i = 0; i < group.rows.length; i += 1) {
          const outputRow = Math.max(0, Number(target.data_start_row || 2) - 1) + i;
          for (const { mapping, column } of dynamicForcedColumns) { const anchor = mergedAnchor(targetBook.sheet, outputRow, column); updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? ''); }
          const rowValues = new Map<string, unknown[]>();
          for (const mapping of mappings.filter((item) => !item.forced_key)) {
            const sourceIndex = source.header.indexOf(mapping.source_column); const targetIndex = targetBook.header.indexOf(mapping.target_column);
            if (sourceIndex < 0 || targetIndex < 0) continue;
            const anchor = mergedAnchor(targetBook.sheet, outputRow, targetIndex); const address = XLSX.utils.encode_cell(anchor);
            const values = rowValues.get(address) || []; values.push(group.rows[i][sourceIndex] ?? ''); rowValues.set(address, values);
          }
          for (const [address, values] of rowValues) updates.set(address, values.filter((value) => String(value).trim() !== '').join('/'));
        }
        const filename = `${safeName(calibrationDate).replace(/-/g, '')}_${safeName(Array.from(group.matchedKeywords).join('、'))}.xlsx`;
        const outputPath = path.join(folderPath, filename); await writeTemplateText(target.file_path, outputPath, updates);
        const size = (await fs.promises.stat(outputPath)).size; const fileId = id('file');
        const previewRows = group.rows.map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => { const index = source.header.indexOf(column); return [column, index >= 0 ? row[index] ?? '' : '']; })));
        await this.db.run(`INSERT INTO transfer_files(id,task_id,target_template_id,template_name,template_group_name,template_item_name,match_keyword,filename,file_path,row_count,file_size,preview_data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [fileId, taskId, targetId, target.name, target.template_group_name || '转送对象模板', target.template_item_name || target.name, target.match_keyword, filename, outputPath, group.rows.length, size, JSON.stringify(previewRows), now()]);
        generated.push({ id: fileId, templateName: target.name, matchKeyword: target.match_keyword, filename, rowCount: group.rows.length, fileSize: size, fileType: 'target' });
      }
      await this.db.run(`UPDATE transfer_tasks SET status='completed', matched_rows=?, skipped_rows=?, completed_at=? WHERE id=?`, [source.data.length - skipped, skipped, now(), taskId]);
      await fs.promises.rm(sourcePath, { force: true });
      return { task: { id: taskId, folderName: taskName, totalRows: source.data.length, matchedRows: source.data.length - skipped, skippedRows: skipped, status: 'completed' }, files: generated };
    } catch (error) {
      await fs.promises.rm(sourcePath, { force: true });
      if (taskId) {
        const files = await this.db.all<any[]>('SELECT file_path FROM transfer_files WHERE task_id = ?', [taskId]);
        for (const generatedFile of files) await fs.promises.rm(generatedFile.file_path, { force: true });
        await this.db.run('DELETE FROM transfer_files WHERE task_id = ?', [taskId]);
        await this.db.run('DELETE FROM transfer_tasks WHERE id = ?', [taskId]);
      }
      if (folderPath) await fs.promises.rm(folderPath, { recursive: true, force: true });
      throw error;
    }
  }

  private async processTwoStage(input: any, file: Express.Multer.File, username = '') {
    const certificateUnit = String(input?.certificateUnit ?? '').trim();
    const certificateAddress = String(input?.certificateAddress ?? '').trim();
    const calibrationDate = String(input?.calibrationDate ?? '').trim();
    if (!certificateUnit || !certificateAddress || !calibrationDate) throw new Error('证书名称、证书地址和校准日期不能为空');

    const sourceTemplateType = input.sourceTemplateType === 'quote' ? 'quote' : 'import';
    const sourceTemplate = sourceTemplateType === 'quote'
      ? await this.db.get<any>('SELECT * FROM transfer_quote_templates WHERE id = ?', [String(input.quoteTemplateId || '')])
      : await this.db.get<any>('SELECT * FROM transfer_import_templates WHERE id = ?', [String(input.importTemplateId || '')]);
    const orderTemplate = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE id = ?', [String(input.orderTemplateId || '')]);
    if (!sourceTemplate) throw new Error(sourceTemplateType === 'quote' ? '未配置所选报价单模板' : '未配置所选导入格式');
    if (!orderTemplate || !orderTemplate.file_path || !fs.existsSync(orderTemplate.file_path)) throw new Error('未配置有效的收发委托单模板');
    const generationMode = String(input.generationMode || 'all') === 'order' ? 'order' : 'all';

    const active = await this.db.get(`SELECT id FROM transfer_tasks WHERE user_name = ? AND status = 'processing'`, [username]);
    if (active) throw new Error('当前已有处理中的任务，请等待完成');
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (decodedName && !decodedName.includes('\ufffd')) file.originalname = decodedName;
    const sourcePath = path.join(TASK_DIR, `${id('source')}-${safeName(file.originalname)}`);
    let taskId = '';
    let folderPath = '';
    try {
    await fs.promises.writeFile(sourcePath, file.buffer);
    const source = readRows(sourcePath, Number(sourceTemplate.header_row || 1), Number(sourceTemplate.data_start_row || 2));
    if (input.sourceRowCount) source.data = source.data.slice(0, Number(input.sourceRowCount));
    const orderBook = readRows(orderTemplate.file_path, Number(orderTemplate.header_row || 1), Number(orderTemplate.data_start_row || 2));
    const orderMappings = sourceTemplateType === 'quote'
      ? await this.db.all<any[]>('SELECT * FROM transfer_quote_order_mappings WHERE quote_template_id = ? AND order_template_id = ? ORDER BY rowid', [sourceTemplate.id, orderTemplate.id])
      : await this.db.all<any[]>('SELECT * FROM transfer_import_mappings WHERE import_template_id = ? AND order_template_id = ? ORDER BY rowid', [sourceTemplate.id, orderTemplate.id]);
    if (!orderMappings.length) {
      await fs.promises.rm(sourcePath, { force: true });
      throw new Error(sourceTemplateType === 'quote' ? '尚未配置报价单到收发委托单的映射关系' : '尚未配置导入格式到收发委托单的映射关系');
    }
    const missingSource = orderMappings.filter((item) => !item.forced_key && item.source_column && source.header.indexOf(item.source_column) < 0).map((item) => item.source_column);
    const missingTarget = orderMappings.filter((item) => (item.target_column || item.target_cell) && !item.target_cell && orderBook.header.indexOf(item.target_column) < 0).map((item) => item.target_column);
    if (missingSource.length || missingTarget.length) {
      await fs.promises.rm(sourcePath, { force: true });
      throw new Error(`映射字段不存在：${[...new Set([...missingSource, ...missingTarget])].join('、')}`);
    }
    const forced = { '证书单位': certificateUnit, '证书地址': certificateAddress, '校准日期': calibrationDate };
    const orderUpdates = new Map<string, unknown>();
    for (const mapping of orderMappings.filter((item) => item.forced_key && item.target_cell)) {
      const cell = cellToAddress(mapping.target_cell);
      const anchor = mergedAnchor(orderBook.sheet, cell.r, cell.c);
      orderUpdates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? '');
    }
    const dynamicForcedMappings = orderMappings.filter((item) => item.forced_key && !item.target_cell);
    this.validateForcedMappings(orderBook, orderMappings);
    const dynamicForcedColumns = dynamicForcedMappings.map((mapping) => ({ mapping, column: orderBook.header.findIndex((header) => header === String(mapping.target_column || mapping.forced_key || '').trim()) })).filter((item) => item.column >= 0);
    for (let i = 0; i < source.data.length; i += 1) {
      const outputRow = Math.max(0, Number(orderTemplate.data_start_row || 2) - 1) + i;
      for (const { mapping, column } of dynamicForcedColumns) {
        const anchor = mergedAnchor(orderBook.sheet, outputRow, column);
        orderUpdates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? '');
      }
      const rowValues = new Map<string, unknown[]>();
      for (const mapping of orderMappings.filter((item) => !item.forced_key && item.source_column && item.target_column)) {
        const sourceIndex = source.header.indexOf(mapping.source_column);
        const targetIndex = orderBook.header.indexOf(mapping.target_column);
        if (sourceIndex < 0 || targetIndex < 0) continue;
        const anchor = mergedAnchor(orderBook.sheet, outputRow, targetIndex);
        const address = XLSX.utils.encode_cell(anchor);
        const values = rowValues.get(address) || [];
        values.push(source.data[i][sourceIndex] ?? '');
        rowValues.set(address, values);
      }
      for (const [address, values] of rowValues) orderUpdates.set(address, values.filter((value) => String(value).trim() !== '').join('/'));
    }

    taskId = id('task');
    const namePrefix = `${safeName(certificateUnit)}_${safeName(calibrationDate).replace(/-/g, '')}`;
    const orderFilename = `${namePrefix}_收发委托单.xlsx`;
    const orderFolderName = `${namePrefix}_收发委托单`;
    folderPath = path.join(TASK_DIR, `${taskId}-${orderFolderName}`);
    await fs.promises.mkdir(folderPath, { recursive: true });
    await this.db.run(`INSERT INTO transfer_tasks(id,user_name,certificate_unit,certificate_address,calibration_date,source_filename,business_type,match_column,status,total_rows,matched_rows,skipped_rows,folder_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [taskId, username, certificateUnit, certificateAddress, calibrationDate, input.sourceFilename || file.originalname, sourceTemplate.name || sourceTemplate.template_name, String(orderTemplate.match_column || '').trim() || '收发委托单', 'processing', source.data.length, 0, 0, orderFolderName, now()]);
    const orderPath = path.join(folderPath, orderFilename);
    await writeTemplateText(orderTemplate.file_path, orderPath, orderUpdates);
    const generated: any[] = [];
    const generatedOrderRows = readRows(orderPath, Number(orderTemplate.header_row || 1), Number(orderTemplate.data_start_row || 2));
    // A workbook template may contain example rows. Only the rows produced
    // from the uploaded file belong to this task.
    generatedOrderRows.data = generatedOrderRows.data.slice(0, source.data.length);
    const orderPreviewRows = generatedOrderRows.data.map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => {
      const index = generatedOrderRows.header.indexOf(column);
      return [column, index >= 0 ? row[index] ?? '' : ''];
    })));
    const orderSize = (await fs.promises.stat(orderPath)).size;
    const orderFileId = id('file');
    await this.db.run(`INSERT INTO transfer_files(id,task_id,target_template_id,template_name,template_group_name,template_item_name,match_keyword,filename,file_path,row_count,file_size,preview_data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [orderFileId, taskId, null, orderTemplate.template_item_name || orderTemplate.template_name || orderTemplate.type_name || '收发委托单', orderTemplate.template_group_name || '收发委托模板', orderTemplate.template_item_name || orderTemplate.template_name || orderTemplate.type_name || '收发委托单', '收发委托单', orderFilename, orderPath, source.data.length, orderSize, JSON.stringify(orderPreviewRows), now()]);
    generated.push({ id: orderFileId, templateName: orderTemplate.template_name || orderTemplate.type_name || '收发委托单', matchKeyword: '收发委托单', filename: orderFilename, rowCount: source.data.length, fileSize: orderSize, fileType: 'order' });

    let skipped = 0;
    const targets = (await this.db.all<any[]>('SELECT * FROM transfer_target_templates')).filter((item) => !isLegacyBusinessType(item.name) && !isLegacyBusinessType(item.match_keyword));
    const matchColumn = String(orderTemplate.match_column || '').trim();
    const matchIndex = generatedOrderRows.header.indexOf(matchColumn);
    if (generationMode === 'all') {
      if (!matchColumn || matchIndex < 0) throw new Error('收发委托单模板缺少转送匹配列');
      const groups = new Map<string, { rows: Row[]; matchedKeywords: Set<string> }>();
      for (const row of generatedOrderRows.data) {
        const value = String(row[matchIndex] ?? '').trim();
        const target = targets.find((item) => splitMatchKeywords(item.match_keyword).includes(value));
        if (!target) { skipped += 1; continue; }
        const group = groups.get(target.id) || { rows: [], matchedKeywords: new Set<string>() };
        group.rows.push(row); group.matchedKeywords.add(value); groups.set(target.id, group);
      }
      for (const [targetId, group] of groups) {
        const target = targets.find((item) => item.id === targetId);
        if (!target || !fs.existsSync(target.file_path)) continue;
        const targetBook = readRows(target.file_path, target.header_row, target.data_start_row);
        const mappings = await this.getTargetMappings(targetId, orderTemplate.id);
        const updates = new Map<string, unknown>();
        this.validateForcedMappings(targetBook, mappings);
        for (const mapping of mappings.filter((item) => item.forced_key && item.target_cell)) {
          const cell = cellToAddress(mapping.target_cell); const anchor = mergedAnchor(targetBook.sheet, cell.r, cell.c);
          updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? '');
        }
        const dynamicForcedColumnsForTarget = mappings.filter((item) => normalizeForcedKey(item.forced_key) === '校准日期' && !item.target_cell).map((mapping) => ({ mapping, column: targetBook.header.findIndex((header) => header === String(mapping.target_column || mapping.forced_key || '').trim()) })).filter((item) => item.column >= 0);
        for (let i = 0; i < group.rows.length; i += 1) {
          const outputRow = Math.max(0, Number(target.data_start_row || 2) - 1) + i;
          for (const { mapping, column } of dynamicForcedColumnsForTarget) { const anchor = mergedAnchor(targetBook.sheet, outputRow, column); updates.set(XLSX.utils.encode_cell(anchor), forced[normalizeForcedKey(mapping.forced_key) as keyof typeof forced] ?? ''); }
          const rowValues = new Map<string, unknown[]>();
          for (const mapping of mappings.filter((item) => !item.forced_key)) {
            const sourceIndex = generatedOrderRows.header.indexOf(mapping.source_column); const targetIndex = targetBook.header.indexOf(mapping.target_column);
            if (sourceIndex < 0 || targetIndex < 0) continue;
            const anchor = mergedAnchor(targetBook.sheet, outputRow, targetIndex); const address = XLSX.utils.encode_cell(anchor);
            const values = rowValues.get(address) || []; values.push(group.rows[i][sourceIndex] ?? ''); rowValues.set(address, values);
          }
          for (const [address, values] of rowValues) updates.set(address, values.filter((value) => String(value).trim() !== '').join('/'));
        }
        const matchedKeywordName = safeName(Array.from(group.matchedKeywords).join('、'));
        const filename = `${namePrefix}_${matchedKeywordName}.xlsx`; const outputPath = path.join(folderPath, filename);
        await writeTemplateText(target.file_path, outputPath, updates);
        const size = (await fs.promises.stat(outputPath)).size; const fileId = id('file');
        const previewRows = group.rows.map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => { const index = generatedOrderRows.header.indexOf(column); return [column, index >= 0 ? row[index] ?? '' : '']; })));
        await this.db.run(`INSERT INTO transfer_files(id,task_id,target_template_id,template_name,template_group_name,template_item_name,match_keyword,filename,file_path,row_count,file_size,preview_data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [fileId, taskId, targetId, target.name, target.template_group_name || '转送对象模板', target.template_item_name || target.name, target.match_keyword, filename, outputPath, group.rows.length, size, JSON.stringify(previewRows), now()]);
        generated.push({ id: fileId, templateName: target.name, matchKeyword: target.match_keyword, filename, rowCount: group.rows.length, fileSize: size, fileType: 'target' });
      }
    }
    await this.db.run(`UPDATE transfer_tasks SET status='completed', matched_rows=?, skipped_rows=?, completed_at=? WHERE id=?`, [generationMode === 'order' ? source.data.length : source.data.length - skipped, generationMode === 'order' ? 0 : skipped, now(), taskId]);
    await fs.promises.rm(sourcePath, { force: true });
    return { task: { id: taskId, folderName: orderFolderName, totalRows: source.data.length, matchedRows: generationMode === 'order' ? source.data.length : source.data.length - skipped, skippedRows: generationMode === 'order' ? 0 : skipped, status: 'completed' }, files: generated };
    } catch (error) {
      await fs.promises.rm(sourcePath, { force: true });
      if (taskId) {
        const files = await this.db.all<any[]>('SELECT file_path FROM transfer_files WHERE task_id = ?', [taskId]);
        for (const generatedFile of files) await fs.promises.rm(generatedFile.file_path, { force: true });
        await this.db.run('DELETE FROM transfer_files WHERE task_id = ?', [taskId]);
        await this.db.run('DELETE FROM transfer_tasks WHERE id = ?', [taskId]);
      }
      if (folderPath) await fs.promises.rm(folderPath, { recursive: true, force: true });
      throw error;
    }
  }

  async process(input: any, file: Express.Multer.File, username = '') {
    if (input?.sourceType === 'quote') return this.processQuote(input, file, username);
    if (input?.sourceType === 'order' || input?.sourceType === 'import') return this.processTargetOnly(input, file, username);
    if (input?.importTemplateId) return this.processTwoStage(input, file, username);
    // Multipart clients and older frontend bundles may omit fields when the
    // first step of the wizard has been unmounted. Normalize and validate
    // them before touching the NOT NULL task columns so SQLite never receives
    // undefined values.
    const certificateUnit = String(input?.certificateUnit ?? '').trim();
    const certificateAddress = String(input?.certificateAddress ?? '').trim();
    const calibrationDate = String(input?.calibrationDate ?? '').trim();
    if (!certificateUnit || !certificateAddress || !calibrationDate) {
      throw new Error('证书名称、证书地址和校准日期不能为空');
    }
    // Multer may expose non-ASCII multipart filenames as Latin-1 bytes.
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (decodedName && !decodedName.includes('\ufffd')) file.originalname = decodedName;
    const requestedItemName = templateItem(input, input.businessType);
    const configuredTemplate = await this.db.get<any>('SELECT * FROM transfer_upload_templates WHERE template_item_name = ? OR template_name = ? OR type_name = ?', [requestedItemName, requestedItemName, requestedItemName]);
    if (!configuredTemplate) throw new Error('未配置所选模板');
    const active = await this.db.get(`SELECT id FROM transfer_tasks WHERE user_name = ? AND status = 'processing'`, [username]); if (active) throw new Error('当前已有处理中的任务，请等待完成');
    const uploadTemplate = configuredTemplate; if (!uploadTemplate) throw new Error('未配置所选模板');
    const sourcePath = path.join(TASK_DIR, `${id('source')}-${safeName(file.originalname)}`); await fs.promises.writeFile(sourcePath, file.buffer);
    const source = readRows(sourcePath, uploadTemplate.header_row, uploadTemplate.data_start_row);
    const matchColumn = String(uploadTemplate.match_column || '').trim();
    const matchIndex = source.header.indexOf(matchColumn);
    if (!matchColumn || matchIndex < 0) {
      await fs.promises.rm(sourcePath, { force: true });
      throw new Error('待处理文件缺少匹配规则列');
    }
    const targets = (await this.db.all<any[]>('SELECT * FROM transfer_target_templates')).filter((item) => !isLegacyBusinessType(item.name) && !isLegacyBusinessType(item.match_keyword));
    // Only columns used by this task are required.  The old implementation
    // compared the upload against every header in the configured reference
    // workbook, which rejected valid files containing only the mapped fields.
    const matchedTargetIds = new Set<string>();
    for (const row of source.data) {
      const value = String(row[matchIndex] ?? '').trim();
      const target = targets.find((item) => splitMatchKeywords(item.match_keyword).includes(value));
      if (target) matchedTargetIds.add(target.id);
    }
    const mappedRows: any[] = [];
    for (const targetId of matchedTargetIds) {
      const effective = await this.getTargetMappings(targetId, configuredTemplate.id);
      mappedRows.push(...effective.filter((item) => !item.forced_key && item.source_column));
    }
    const requiredColumns = [...new Set([matchColumn, ...mappedRows.map((item) => String(item.source_column || '').trim()).filter(Boolean)])];
    const missingColumns = requiredColumns.filter((column) => !source.header.includes(column));
    if (missingColumns.length) {
      await fs.promises.rm(sourcePath, { force: true });
      throw new Error(`待处理文件缺少必要字段：${missingColumns.join('、')}`);
    }
    const groups = new Map<string, { rows: Row[]; matchedKeywords: Set<string> }>();
    let skipped = 0;
    for (const row of source.data) {
      const value = String(row[matchIndex] ?? '').trim();
      const target = targets.find((item) => splitMatchKeywords(item.match_keyword).includes(value));
      if (!target) {
        skipped += 1;
        continue;
      }

      const group = groups.get(target.id) || { rows: [], matchedKeywords: new Set<string>() };
      group.rows.push(row);
      group.matchedKeywords.add(value);
      groups.set(target.id, group);
    }
    const allMatchedKeywords = Array.from(new Set(
      Array.from(groups.values()).flatMap((group) => Array.from(group.matchedKeywords)),
    ));
    const taskId = id('task');
    const namePrefix = `${safeName(certificateUnit)}_${safeName(calibrationDate).replace(/-/g, '')}`;
    const folderName = `${namePrefix}_${safeName(allMatchedKeywords.join('、'))}`;
    const folderPath = path.join(TASK_DIR, `${taskId}-${folderName}`); await fs.promises.mkdir(folderPath, { recursive: true });
    await this.db.run(`INSERT INTO transfer_tasks(id,user_name,certificate_unit,certificate_address,calibration_date,source_filename,business_type,match_column,status,total_rows,matched_rows,skipped_rows,folder_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [taskId, username, certificateUnit, certificateAddress, calibrationDate, file.originalname, requestedItemName, matchColumn, 'processing', source.data.length, source.data.length - skipped, skipped, folderName, now()]);
    const generated: any[] = [];
    for (const [targetId, group] of groups) {
      const { rows } = group;
      const matchedKeywordName = safeName(Array.from(group.matchedKeywords).join('、'));
      const target = targets.find((item) => item.id === targetId);
      if (!target || !fs.existsSync(target.file_path)) continue;
      const targetBook = readRows(target.file_path, target.header_row, target.data_start_row);
      const mappings = await this.getTargetMappings(targetId, configuredTemplate.id);
      const previewRows = rows.map((row) => Object.fromEntries(PREVIEW_COLUMNS.map((column) => {
        const sourceIndex = source.header.indexOf(column);
        return [column, sourceIndex >= 0 ? row[sourceIndex] ?? '' : ''];
      })));
      const updates = new Map<string, unknown>();
      this.validateForcedMappings(targetBook, mappings);
      const forced = { '证书单位': certificateUnit, '证书地址': certificateAddress, '校准日期': calibrationDate };
      // A forced value can target either a fixed cell (legacy templates) or a
      // column in the configured header row.  The latter is useful for list
      // templates where each generated data row has its own calibration-date
      // cell and no stable absolute address.
      const dynamicForcedMappings = mappings.filter(
        (item) => normalizeForcedKey(item.forced_key) === '校准日期' && !item.target_cell,
      );
      for (const mapping of mappings.filter((item) => item.forced_key && item.target_cell)) {
        const cell = cellToAddress(mapping.target_cell);
        const anchor = mergedAnchor(targetBook.sheet, cell.r, cell.c);
        const forcedKey = normalizeForcedKey(mapping.forced_key) as keyof typeof forced;
        updates.set(XLSX.utils.encode_cell(anchor), forced[forcedKey] ?? '');
      }
      const dynamicForcedColumns = dynamicForcedMappings
        .map((mapping) => ({
          mapping,
          column: targetBook.header.findIndex(
            (header) => header === String(mapping.target_column || mapping.forced_key || '').trim(),
          ),
        }))
        .filter((item) => item.column >= 0);
      for (let i = 0; i < rows.length; i += 1) {
        const outputRow = Math.max(0, Number(target.data_start_row || 2) - 1) + i;
        for (const { mapping, column } of dynamicForcedColumns) {
          const anchor = mergedAnchor(targetBook.sheet, outputRow, column);
          const forcedKey = normalizeForcedKey(mapping.forced_key) as keyof typeof forced;
          updates.set(XLSX.utils.encode_cell(anchor), forced[forcedKey] ?? '');
        }
        const rowMappedValues = new Map<string, unknown[]>();
        for (const mapping of mappings.filter((item) => !item.forced_key)) {
          const sourceIndex = source.header.indexOf(mapping.source_column);
          const targetIndex = targetBook.header.indexOf(mapping.target_column);
          if (sourceIndex >= 0 && targetIndex >= 0) {
            const anchor = mergedAnchor(targetBook.sheet, outputRow, targetIndex);
            const address = XLSX.utils.encode_cell(anchor);
            const values = rowMappedValues.get(address) || [];
            values.push(rows[i][sourceIndex] ?? '');
            rowMappedValues.set(address, values);
          }
        }
        for (const [address, values] of rowMappedValues) {
          updates.set(
            address,
            values.filter((value) => String(value).trim() !== '').join('/'),
          );
        }
      }
      const filename = `${namePrefix}_${matchedKeywordName}.xlsx`;
      const outputPath = path.join(folderPath, filename);
      await writeTemplateText(target.file_path, outputPath, updates);
      const size = (await fs.promises.stat(outputPath)).size;
      const fileId = id('file');
      await this.db.run(`INSERT INTO transfer_files(id,task_id,target_template_id,template_name,template_group_name,template_item_name,match_keyword,filename,file_path,row_count,file_size,preview_data_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [fileId, taskId, targetId, target.name, target.template_group_name || '转送对象模板', target.template_item_name || target.name, target.match_keyword, filename, outputPath, rows.length, size, JSON.stringify(previewRows), now()]);
      generated.push({ id: fileId, templateName: target.name, matchKeyword: target.match_keyword, filename, rowCount: rows.length, fileSize: size });
    }
    await this.db.run(`UPDATE transfer_tasks SET status='completed',completed_at=? WHERE id=?`, [now(), taskId]); await fs.promises.rm(sourcePath, { force: true }); return { task: { id: taskId, folderName, totalRows: source.data.length, matchedRows: source.data.length - skipped, skippedRows: skipped, status: 'completed' }, files: generated };
  }

  async listTasks(username = '') {
    // Transfer tasks are shared operational data. All users with
    // transfer:view must see the same task set; username is retained only for
    // backwards compatibility with older callers.
    const [tasks, files] = await Promise.all([
      this.db.all<any[]>('SELECT * FROM transfer_tasks ORDER BY created_at DESC'),
      this.db.all<any[]>('SELECT * FROM transfer_files ORDER BY task_id, template_name'),
    ]);
    const filesByTask = new Map<string, any[]>();
    for (const file of files) {
      const taskFiles = filesByTask.get(file.task_id) || [];
      taskFiles.push(file);
      filesByTask.set(file.task_id, taskFiles);
    }
    for (const task of tasks) {
      task.files = filesByTask.get(task.id) || [];
      for (const file of task.files) {
        if (file.preview_data_json) continue;
        const previewRows = await this.rebuildPreviewRows(file);
        if (!previewRows.length) continue;
        file.preview_data_json = JSON.stringify(previewRows);
        await this.db.run('UPDATE transfer_files SET preview_data_json = ? WHERE id = ?', [file.preview_data_json, file.id]);
      }
    }
    return tasks;
  }
  async deleteTask(taskId: string, username = '') {
    // Tasks are shared operational records. Visibility and mutation are
    // controlled by route permissions, never by the creating username.
    const task = await this.db.get<any>('SELECT * FROM transfer_tasks WHERE id = ?', [taskId]);
    if (!task) throw new Error('任务不存在');
    const files = await this.db.all<any[]>('SELECT file_path FROM transfer_files WHERE task_id = ?', [taskId]);
    for (const file of files) await fs.promises.rm(file.file_path, { force: true });
    const taskDir = path.join(TASK_DIR, `${taskId}-${task.folder_name}`);
    await fs.promises.rm(taskDir, { recursive: true, force: true });
    await this.db.run('DELETE FROM transfer_files WHERE task_id = ?', [taskId]);
    await this.db.run('DELETE FROM transfer_tasks WHERE id = ?', [taskId]);
  }
  async getFile(fileId: string) { return this.db.get<any>('SELECT * FROM transfer_files WHERE id = ?', [fileId]); }
  async getTask(taskId: string) { return this.db.get<any>('SELECT * FROM transfer_tasks WHERE id = ?', [taskId]); }
  async getTaskFilesByKeyword(taskId: string, keyword: string) {
    return this.db.all<any[]>('SELECT * FROM transfer_files WHERE task_id = ? AND match_keyword = ? ORDER BY template_name', [taskId, keyword]);
  }
  async markDownloaded(fileId: string) { await this.db.run('UPDATE transfer_files SET downloaded=1 WHERE id=?', [fileId]); }
  async getZip(taskId: string, fileIds?: string[]) { const task = await this.getTask(taskId); if (!task) throw new Error('任务不存在'); const files = await this.db.all<any[]>('SELECT * FROM transfer_files WHERE task_id=?', [taskId]); const selected = fileIds?.length ? files.filter((item) => fileIds.includes(item.id)) : files; const entries = []; for (const item of selected) if (fs.existsSync(item.file_path)) entries.push({ name: path.basename(item.filename), data: await fs.promises.readFile(item.file_path) }); return { filename: `${task.folder_name}.zip`, data: await zipBuffers(entries) }; }
  async cleanupExpired() { const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; const tasks = await this.db.all<any[]>('SELECT id FROM transfer_tasks WHERE created_at < ? AND id NOT IN (SELECT DISTINCT task_id FROM transfer_files WHERE downloaded = 0)', [new Date(cutoff).toISOString()]); for (const task of tasks) { const files = await this.db.all<any[]>('SELECT file_path FROM transfer_files WHERE task_id=?', [task.id]); const folders = new Set<string>(); for (const file of files) { folders.add(path.dirname(file.file_path)); await fs.promises.rm(file.file_path, { force: true }); } for (const folder of folders) await fs.promises.rm(folder, { recursive: true, force: true }); await this.db.run('DELETE FROM transfer_tasks WHERE id=?', [task.id]); } return tasks.length; }
}
export default new OneClickTransferService();


