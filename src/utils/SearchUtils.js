import pinyin from 'pinyin';

/**
 * 拼音搜索工具
 * 支持中英文混合搜索
 */
export const searchByPinyin = (items, searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }

  const lowerTerm = searchTerm.toLowerCase();
  
  return items.filter(item => {
    // 遍历项目的所有属性
    for (const key in item) {
      if (item.hasOwnProperty(key)) {
        const value = item[key];
        if (typeof value === 'string' && value.length > 0) {
          // 检查原始文本是否包含搜索词
          if (value.toLowerCase().includes(lowerTerm)) {
            return true;
          }
          
          // 检查拼音是否包含搜索词
          try {
            const pinyinResult = pinyin(value, {
              style: pinyin.STYLE_NORMAL,
              heteronym: false
            }).join('').toLowerCase();
            
            if (pinyinResult.includes(lowerTerm)) {
              return true;
            }
          } catch (error) {
            console.error('拼音转换失败:', error);
          }
        }
      }
    }
    return false;
  });
};

/**
 * 数字搜索工具
 * 专门用于处理数字字段的搜索
 */
export const searchByNumber = (items, searchTerm, numberFields = []) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }

  // 尝试将搜索词转换为数字
  const numberTerm = parseFloat(searchTerm);
  
  // 如果不是有效数字，返回原始列表
  if (isNaN(numberTerm)) {
    return items;
  }
  
  return items.filter(item => {
    // 遍历指定的数字字段
    for (const field of numberFields) {
      if (item.hasOwnProperty(field)) {
        const value = item[field];
        
        // 尝试将字段值转换为数字
        const fieldValue = parseFloat(value);
        
        // 如果字段值是有效数字且等于搜索词，返回true
        if (!isNaN(fieldValue) && fieldValue === numberTerm) {
          return true;
        }
      }
    }
    return false;
  });
};

/**
 * 高级搜索工具
 * 结合拼音搜索和数字搜索
 */
export const advancedSearch = (items, searchTerm, numberFields = []) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }
  
  // 首先尝试数字搜索
  const numberResults = searchByNumber(items, searchTerm, numberFields);
  
  // 如果数字搜索有结果，返回这些结果
  if (numberResults.length > 0) {
    return numberResults;
  }
  
  // 否则使用拼音搜索
  return searchByPinyin(items, searchTerm);
};

/**
 * 获取搜索建议
 * 从搜索结果中提取可能的建议项
 */
export const getSearchSuggestions = (items, searchTerm, maxSuggestions = 10) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }
  
  const lowerTerm = searchTerm.toLowerCase();
  const suggestions = new Set();
  
  // 从搜索结果中收集所有字符串值
  items.forEach(item => {
    Object.values(item).forEach(val => {
      if (typeof val === 'string' && val.length > 0) {
        // 检查原始文本是否包含搜索词
        if (val.toLowerCase().includes(lowerTerm)) {
          suggestions.add(val);
        }
        
        // 检查拼音是否包含搜索词
        try {
          const pinyinResult = pinyin(val, {
            style: pinyin.STYLE_NORMAL,
            heteronym: false
          }).join('').toLowerCase();
          
          if (pinyinResult.includes(lowerTerm)) {
            suggestions.add(val);
          }
        } catch (error) {
          console.error('拼音转换失败:', error);
        }
      }
    });
  });
  
  // 转换为数组并限制数量
  return Array.from(suggestions).slice(0, maxSuggestions);
};