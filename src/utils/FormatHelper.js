// FormatHelper工具类，提供文本格式化相关功能
class FormatHelper {
  // 格式化日期时间
  static formatDateTime(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 格式化日期
  static formatDate(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // 格式化时间
  static formatTime(date) {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  }

  // 生成唯一ID
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 格式化HTML标签
  static formatHtmlTags(text) {
    if (!text || typeof text !== 'string') return '';
    
    // 将常见HTML标签进行转义或处理
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>')
      .replace(/\s{2,}/g, '&nbsp;');
  }

  // 去除HTML标签
  static removeHtmlTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '');
  }

  // 首字母大写
  static capitalizeFirstLetter(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // 千分位格式化数字
  static formatNumber(num) {
    if (num === null || num === undefined || isNaN(Number(num))) return '';
    return Number(num).toLocaleString('zh-CN');
  }

  // 格式化手机号码
  static formatPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return '';
    // 去除非数字字符
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 11) return phone;
    // 格式化为 138-1234-5678
    return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  // 格式化身份证号码
  static formatIdCard(idCard) {
    if (!idCard || typeof idCard !== 'string') return '';
    if (idCard.length !== 18) return idCard;
    // 格式化为 xxxx-xxxx-xxxx-xxxx-x
    return idCard.replace(/(\d{4})(\d{4})(\d{4})(\d{4})(\d{2}[\dxX])/, '$1-$2-$3-$4-$5');
  }
}

export default FormatHelper;