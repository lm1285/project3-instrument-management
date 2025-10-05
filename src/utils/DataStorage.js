// DataStorage工具类，用于管理localStorage数据
/**
 * DataStorage工具类，用于管理localStorage数据
 */
class DataStorage {
  /**
   * 构造函数
   * @param {string} storageKey - 存储键名
   */
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  /**
   * 获取所有数据
   * @returns {Array} 存储的数据数组
   */
  getAllData() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading data from localStorage:', error);
      return [];
    }
  }

  /**
   * 兼容性方法：获取所有数据（别名）
   * @returns {Array} 存储的数据数组
   */
  getAll() {
    return this.getAllData();
  }

  // 保存所有数据
  saveAllData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data to localStorage:', error);
    }
  }

  /**
   * 兼容性方法：保存所有数据（别名）
   * @param {Array} data - 要保存的数据数组
   */
  saveAll(data) {
    this.saveAllData(data);
  }

  /**
   * 兼容性方法：添加数据（别名）
   * @param {Object} item - 要添加的数据项
   * @returns {Object|null} 添加的数据项或null（如果失败）
   */
  add(item) {
    return this.addData(item);
  }

  // 添加一条数据
  addData(item) {
    try {
      const data = this.getAllData();
      // 为新添加的项目生成唯一ID（如果没有）
      const itemWithId = {
        ...item,
        id: item.id || this.generateUniqueId(),
        createdAt: item.createdAt || new Date().toISOString()
      };
      data.push(itemWithId);
      this.saveAllData(data);
      return itemWithId;
    } catch (error) {
      console.error('Error adding data:', error);
      return null;
    }
  }

  // 生成唯一ID
  generateUniqueId() {
    // 使用时间戳 + 随机数生成唯一ID
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 兼容性方法：更新数据（别名）
   * @param {string} id - 数据ID
   * @param {Object} updatedItem - 更新的数据对象
   * @returns {boolean} 更新是否成功
   */
  update(id, updatedItem) {
    return this.updateData(id, updatedItem);
  }

  // 更新一条数据
  updateData(id, updatedItem) {
    const data = this.getAllData();
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updatedItem };
      this.saveAllData(data);
      return true;
    }
    return false;
  }

  /**
   * 兼容性方法：删除数据（别名）
   * @param {string} id - 数据ID
   * @returns {boolean} 删除是否成功
   */
  remove(id) {
    return this.deleteData(id);
  }

  // 删除一条数据
  deleteData(id) {
    const data = this.getAllData();
    const filteredData = data.filter(item => item.id !== id);
    this.saveAllData(filteredData);
    return data.length !== filteredData.length;
  }

  // 根据ID获取数据
  getDataById(id) {
    const data = this.getAllData();
    return data.find(item => item.id === id);
  }

  // 清除所有数据
  clearData() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing data from localStorage:', error);
    }
  }

  // 批量导入数据
  importData(newData) {
    try {
      this.saveAllData(newData);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // 搜索数据
  searchData(keyword, searchFields) {
    const data = this.getAllData();
    if (!keyword || !searchFields.length) return data;
    
    const lowerKeyword = keyword.toLowerCase();
    return data.filter(item => 
      searchFields.some(field => {
        const fieldValue = item[field];
        if (fieldValue === null || fieldValue === undefined) return false;
        return String(fieldValue).toLowerCase().includes(lowerKeyword);
      })
    );
  }
}

export default DataStorage;