/**
 * 搜索工具函数集合
 * 提供模糊搜索、拼音搜索等功能
 */

/**
 * 判断字符串是否包含另一个字符串（支持拼音搜索）
 * @param source 源字符串
 * @param target 目标字符串（搜索词）
 * @param usePinyin 是否启用拼音搜索
 * @returns 是否匹配
 */
export function contains(source: string, target: string, usePinyin: boolean = false): boolean {
  if (!source || !target) {
    return false;
  }

  const sourceLower = String(source).toLowerCase();
  const targetLower = String(target).toLowerCase();

  // 普通字符串包含检查
  if (sourceLower.includes(targetLower)) {
    return true;
  }

  // 如果启用了拼音搜索，进行拼音匹配
  if (usePinyin) {
    // 注意：这里使用了简化的拼音搜索逻辑
    // 实际项目中可能需要引入专门的拼音库（如pinyin）来提高准确性
    return matchesPinyin(sourceLower, targetLower);
  }

  return false;
}

/**
 * 简化的拼音匹配函数
 * 注意：这是一个简化版实现，实际项目中应使用专门的拼音库
 * @param source 源字符串
 * @param target 目标字符串
 * @returns 是否匹配
 */
function matchesPinyin(source: string, target: string): boolean {
  // 这里是简化实现，实际项目中应使用专门的拼音库
  // 例如可以使用 pinyin 库将中文转换为拼音后再进行匹配
  // 下面提供一个简化的实现示例
  
  // 简单的常见汉字拼音映射示例
  const pinyinMap: Record<string, string> = {
    // 这里仅作为示例，实际项目应使用完整的拼音库
    '仪': 'yi',
    '器': 'qi',
    '测': 'ce',
    '量': 'liang',
    '管': 'guan',
    '理': 'li',
    '编': 'bian',
    '号': 'hao',
    '名': 'ming',
    '称': 'cheng',
    '型': 'xing',
    '出': 'chu',
    '厂': 'chang',
    '范': 'fan',
    '围': 'wei'
  };

  // 将源字符串中的汉字转换为拼音
  let sourcePinyin = '';
  for (const char of source) {
    sourcePinyin += pinyinMap[char] || char;
  }

  return sourcePinyin.includes(target);
}

/**
 * 在数组中搜索匹配的元素
 * @param items 要搜索的数组
 * @param searchTerm 搜索词
 * @param searchKeys 要搜索的字段名数组
 * @param options 搜索选项
 * @returns 匹配的元素数组
 */
export function searchArray<T extends Record<string, any>>(
  items: T[],
  searchTerm: string,
  searchKeys: (keyof T)[],
  options?: {
    usePinyin?: boolean;
    caseSensitive?: boolean;
  }
): T[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }

  const { usePinyin = false, caseSensitive = false } = options || {};
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  return items.filter(item => {
    return searchKeys.some(key => {
      const value = item[key];
      if (value === null || value === undefined) {
        return false;
      }

      const valueStr = String(value);
      const compareValue = caseSensitive ? valueStr : valueStr.toLowerCase();
      
      if (compareValue.includes(term)) {
        return true;
      }

      return usePinyin && matchesPinyin(compareValue, term);
    });
  });
}

/**
 * 高级搜索 - 根据多条件筛选数组
 * @param items 要筛选的数组
 * @param conditions 筛选条件
 * @returns 筛选后的元素数组
 */
export function advancedSearch<T extends Record<string, any>>(
  items: T[],
  conditions: {
    key: keyof T;
    value: any;
    operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
    usePinyin?: boolean;
  }[]
): T[] {
  if (!conditions || conditions.length === 0) {
    return items;
  }

  return items.filter(item => {
    return conditions.every(condition => {
      const { key, value, operator = 'contains', usePinyin = false } = condition;
      const itemValue = item[key];
      
      // 如果项目值为空，且搜索值不为空，则不匹配
      if (itemValue === null || itemValue === undefined) {
        return value === null || value === undefined;
      }

      const itemValueStr = String(itemValue).toLowerCase();
      const searchValueStr = String(value).toLowerCase();

      switch (operator) {
        case 'equals':
          return itemValueStr === searchValueStr;
        case 'contains':
          return itemValueStr.includes(searchValueStr) || 
                (usePinyin && matchesPinyin(itemValueStr, searchValueStr));
        case 'startsWith':
          return itemValueStr.startsWith(searchValueStr);
        case 'endsWith':
          return itemValueStr.endsWith(searchValueStr);
        case 'greaterThan':
          return Number(itemValue) > Number(value);
        case 'lessThan':
          return Number(itemValue) < Number(value);
        default:
          return false;
      }
    });
  });
}

/**
 * 防抖函数 - 用于优化搜索输入
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

export default {
  contains,
  searchArray,
  advancedSearch,
  debounce
};