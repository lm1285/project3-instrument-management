/**
 * SearchHelper工具类，提供搜索相关的辅助方法
 */
import pinyin from 'pinyin';

class SearchHelper {
  /**
   * 转换中文为拼音（不带声调）
   * @param {string} text - 要转换的中文文本
   * @returns {string} 转换后的拼音字符串
   */
  static toPinyin(text) {
    if (!text || typeof text !== 'string') return '';
    
    try {
      const result = pinyin(text, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false
      });
      return result.flat().join('');
    } catch (error) {
      console.error('Error converting to pinyin:', error);
      return text;
    }
  }

  /**
   * 提取文本中的数字
   * @param {string} text - 要提取数字的文本
   * @returns {string} 提取的数字字符串
   */
  static extractNumbers(text) {
    if (!text || typeof text !== 'string') return '';
    const numbers = text.match(/\d+/g);
    return numbers ? numbers.join('') : '';
  }

  /**
   * 执行拼音搜索
   * @param {Array} items - 要搜索的项目数组
   * @param {string} keyword - 搜索关键词
   * @param {Array} fields - 要搜索的字段数组
   * @returns {Array} 匹配的项目数组
   */
  static pinyinSearch(items, keyword, fields) {
    if (!keyword || !items || items.length === 0) return items;
    
    const lowerKeyword = keyword.toLowerCase();
    return items.filter(item => 
      fields.some(field => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        
        const textValue = String(value).toLowerCase();
        const pinyinValue = this.toPinyin(textValue).toLowerCase();
        
        return textValue.includes(lowerKeyword) || pinyinValue.includes(lowerKeyword);
      })
    );
  }

  /**
   * 执行数字搜索
   * @param {Array} items - 要搜索的项目数组
   * @param {string} keyword - 搜索关键词
   * @param {Array} fields - 要搜索的字段数组
   * @returns {Array} 匹配的项目数组
   */
  static numberSearch(items, keyword, fields) {
    if (!keyword || !items || items.length === 0) return items;
    
    const searchNumbers = this.extractNumbers(keyword);
    if (!searchNumbers) return items;
    
    return items.filter(item => 
      fields.some(field => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        
        const itemNumbers = this.extractNumbers(String(value));
        return itemNumbers.includes(searchNumbers);
      })
    );
  }

  // 综合搜索（同时考虑中文、拼音和数字）
  static comprehensiveSearch(items, keyword, fields) {
    if (!keyword || !items || items.length === 0) return items;
    
    const pinyinResults = this.pinyinSearch(items, keyword, fields);
    const numberResults = this.numberSearch(items, keyword, fields);
    
    // 合并结果，去除重复项
    const allResults = [...pinyinResults, ...numberResults];
    const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());
    
    return uniqueResults;
  }
}

export default SearchHelper;