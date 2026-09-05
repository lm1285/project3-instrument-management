const test = require('node:test');
const assert = require('node:assert/strict');

const {
  joinMappedValues,
  mappingValidationIssues,
  matchesTargetKeyword,
  normalizeExcludedKeyword,
  normalizeMatchKeyword,
  rankSourceTemplates,
  shouldUseDirectTargetMappings,
  toFilesystemPath,
} = require('../dist/services/oneClickTransferService');

test('keeps normal paths portable and does not double-prefix extended Windows paths', () => {
  const normalPath = process.platform === 'win32' ? 'C:\\data\\task\\file.xlsx' : '/tmp/task/file.xlsx';
  const expectedPath = process.platform === 'win32' ? '\\\\?\\C:\\data\\task\\file.xlsx' : normalPath;
  assert.equal(toFilesystemPath(normalPath), expectedPath);
  assert.equal(toFilesystemPath('\\\\?\\C:\\data\\task\\file.xlsx'), '\\\\?\\C:\\data\\task\\file.xlsx');
});

test('normalizes excluded keywords with trim, NFKC, uppercase and space removal', () => {
  assert.equal(normalizeExcludedKeyword('  ａ  （不带标） '), 'A(不带标)');
  assert.equal(normalizeExcludedKeyword(' 华 屹 '), '华屹');
});

test('normalizes full-width letters, case, brackets and certificate suffixes', () => {
  const variants = [' B ', 'ｂ', 'b(不带标)', 'B（不带标）', 'B不带标', 'B带标'];
  assert.deepEqual(variants.map(normalizeMatchKeyword), variants.map(() => 'B'));
  for (const value of variants) assert.equal(matchesTargetKeyword('中溯,B', value), true);
  assert.equal(matchesTargetKeyword('中溯,B', 'EX'), false);
});

test('matches standalone keywords inside a delimited description without substring false positives', () => {
  assert.equal(matchesTargetKeyword('B,A', 'B，校准点100，A，测100'), true);
  assert.equal(matchesTargetKeyword('B', 'B+补充说明'), true);
  assert.equal(matchesTargetKeyword('B', 'AB'), false);
  assert.equal(matchesTargetKeyword('中溯', '中溯检测'), false);
});

test('ignores placeholder values and removes duplicates when fields merge', () => {
  assert.equal(joinMappedValues(['', '/', '\\', 'NA', 'n/a', 'AXD-01', 'AXD-01']), 'AXD-01');
  assert.equal(joinMappedValues(['A-01', 'B-02']), 'A-01/B-02');
});

test('ranks templates using each template own header row across source types', () => {
  const rows = [
    ['报价说明'],
    ['仪器名称', '型号规格', '制造厂', '备注'],
    ['测试仪', 'M1', '制造商', 'B'],
  ];
  const ranked = rankSourceTemplates(rows, [
    { type: 'quote', id: 'q1', groupName: '报价单模板组', itemName: '报价单', headerRow: 1, headers: ['仪器名称', '型号规格', '制造厂', '备注'] },
    { type: 'import', id: 'i1', groupName: '导入格式模板组', itemName: '导入格式', headerRow: 2, headers: ['仪器名称', '型号规格', '制造厂', '备注'] },
    { type: 'order', id: 'o1', groupName: '收发委托模板组', itemName: '收发委托单', headerRow: 3, headers: ['仪器名称', '型号规格', '制造厂家', '收件备注'] },
  ]);
  assert.equal(ranked[0].type, 'import');
  assert.equal(ranked[0].score, 1);
  assert.equal(ranked[0].matchedCount, 4);
});

test('reports incomplete and stale two-stage mappings before generation', () => {
  const source = ['仪器名称', '制造厂家', '收件备注'];
  const target = ['器具名称', '制造厂商', '校准日期'];
  assert.deepEqual(mappingValidationIssues(source, target, []), ['未配置映射']);
  assert.deepEqual(mappingValidationIssues(source, target, [
    { source_column: '仪器名称', target_column: '器具名称' },
    { source_column: '制造厂', target_column: '制造厂商' },
    { source_column: '', target_column: '' },
    { forced_key: '校准日期', target_cell: 'bad-cell' },
  ]), [
    '源字段不存在：制造厂',
    '存在未完成的字段映射',
    '固定单元格不存在：bad-cell',
  ]);
});

test('prefers quote-to-target mappings only when a quote-specific mapping exists', () => {
  assert.equal(shouldUseDirectTargetMappings('quote', [{ source_column: '制造厂', target_column: '制造商' }]), true);
  assert.equal(shouldUseDirectTargetMappings('quote', []), false);
  assert.equal(shouldUseDirectTargetMappings('import', [{ source_column: '制造厂', target_column: '制造商' }]), false);
});
