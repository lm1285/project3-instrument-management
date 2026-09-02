/**
 * 日期工具函数集合
 * 提供日期格式化、比较、计算等功能
 */

/**
 * 格式化日期为指定格式
 * @param date 日期对象或日期字符串
 * @param format 格式化模板，默认为 'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | string | number, format: string = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return '';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 获取两个日期之间的天数差
 * @param date1 第一个日期
 * @param date2 第二个日期
 * @returns 天数差
 */
export function getDaysDifference(date1: Date | string | number, date2: Date | string | number): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // 将时间部分设置为0，只比较日期
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * 判断日期是否在指定范围内
 * @param date 要检查的日期
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 是否在范围内
 */
export function isDateInRange(
  date: Date | string | number,
  startDate: Date | string | number,
  endDate: Date | string | number
): boolean {
  const d = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return d >= start && d <= end;
}

/**
 * 添加天数到日期
 * @param date 基础日期
 * @param days 要添加的天数
 * @returns 新的日期对象
 */
export function addDays(date: Date | string | number, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 获取指定月份的第一天
 * @param date 日期对象或日期字符串
 * @returns 该月第一天的日期对象
 */
export function getFirstDayOfMonth(date: Date | string | number): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * 获取指定月份的最后一天
 * @param date 日期对象或日期字符串
 * @returns 该月最后一天的日期对象
 */
export function getLastDayOfMonth(date: Date | string | number): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * 获取本周的开始日期（周一）
 * @param date 日期对象或日期字符串
 * @returns 本周开始日期
 */
export function getStartOfWeek(date: Date | string | number): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整为周一
  return new Date(d.setDate(diff));
}

/**
 * 获取本周的结束日期（周日）
 * @param date 日期对象或日期字符串
 * @returns 本周结束日期
 */
export function getEndOfWeek(date: Date | string | number): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day); // 调整为周日
  return new Date(d.setDate(diff));
}

/**
 * 获取当前日期的ISO格式字符串
 * @returns ISO格式的日期字符串
 */
export function getCurrentISODate(): string {
  return new Date().toISOString();
}

/**
 * 格式化相对时间（如：3天前，1小时前）
 * @param date 日期对象或日期字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const past = new Date(date);
  const diffTime = Math.abs(now.getTime() - past.getTime());
  
  const seconds = Math.floor(diffTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (years > 0) {
    return `${years}年前`;
  } else if (months > 0) {
    return `${months}个月前`;
  } else if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

/**
 * 尝试解析可能的 Excel 序列号日期
 * @param dateStr 输入的日期字符串或数字
 * @returns 解析后的 Date 对象，如果不是序列号则返回 null
 */
export function parseExcelSerialDate(dateStr: string | number): Date | null {
  if (!dateStr) return null;
  
  // 如果是数字或纯数字字符串 (5位，对应 1927-2173 年)
  if (typeof dateStr === 'number' || (typeof dateStr === 'string' && /^\d{5}$/.test(dateStr))) {
    const serial = typeof dateStr === 'number' ? dateStr : parseInt(dateStr, 10);
    // Excel base date (1900-01-01) differs from Unix epoch (1970-01-01) by 25569 days
    // 25569 = days between 1900-01-01 and 1970-01-01
    // 86400 * 1000 = ms per day
    return new Date((serial - 25569) * 86400 * 1000);
  }
  return null;
}

export default {
  formatDate,
  getDaysDifference,
  isDateInRange,
  addDays,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getStartOfWeek,
  getEndOfWeek,
  getCurrentISODate,
  formatRelativeTime,
  parseExcelSerialDate
};