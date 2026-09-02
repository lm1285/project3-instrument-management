
/**
 * 提取测量范围字符串中的单位
 * @param rangeStr 测量范围字符串
 * @returns 单位字符串 (小写)
 */
export function extractUnit(rangeStr: string): string {
  if (!rangeStr) return '';
  
  // 移除空格
  const s = rangeStr.trim();
  
  // 尝试匹配结尾的非数字字符
  // 常见格式: "0~100kPa", "(0-100)V", "±50mm"
  // 简单的策略: 从后往前找，直到遇到数字或结尾符号
  
  // 排除一些特殊结尾符号，如右括号
  let end = s.length - 1;
  while (end >= 0 && (s[end] === ')' || s[end] === '）')) {
    end--;
  }
  
  let start = end;
  while (start >= 0) {
    const code = s.charCodeAt(start);
    // 如果是数字 (0-9) 或者是小数点(.) 或者是负号(-) 或者是波浪号(~)
    // 注意：有些单位可能包含数字 (e.g. m2, m3)，这是一个难点。
    // 这里采用简单策略：只要不是数字和常见分隔符，就认为是单位的一部分
    if ((code >= 48 && code <= 57) || s[start] === '.' || s[start] === ')' || s[start] === '）') {
      break;
    }
    start--;
  }
  
  // 如果没有找到单位部分
  if (start === end) return '';
  
  let unit = s.substring(start + 1, end + 1).trim();
  
  // 移除可能的括号前缀 (e.g. if extracted "kPa)", we already handled ')' above)
  
  return unit.toLowerCase();
}

/**
 * 检查两个测量范围的单位是否一致
 * @param range1 
 * @param range2 
 */
export function isUnitMatch(range1: string, range2: string): boolean {
  const u1 = extractUnit(range1);
  const u2 = extractUnit(range2);
  return u1 === u2;
}
