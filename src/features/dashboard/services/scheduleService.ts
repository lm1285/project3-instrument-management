import apiClient from '../../../services/apiClient';

class ScheduleService {
  async getScheduleTable(name: string = 'default') {
    try {
      const response = await apiClient.get(`/schedule/table/${name}`);
      return response.data;
    } catch (error) {
      console.error('\u83b7\u53d6\u4e0b\u573a\u5b89\u6392\u6570\u636e\u5931\u8d25:', error);
      throw error;
    }
  }

  async saveScheduleTable(data: any, name: string = 'default') {
    try {
      const response = await apiClient.post(`/schedule/table/${name}`, data);
      return response.data;
    } catch (error) {
      console.error('\u4fdd\u5b58\u4e0b\u573a\u5b89\u6392\u6570\u636e\u5931\u8d25:', error);
      throw error;
    }
  }

  async getAllScheduleTables() {
    try {
      const response = await apiClient.get('/schedule/tables');
      return response.data;
    } catch (error) {
      console.error('\u83b7\u53d6\u6240\u6709\u4e0b\u573a\u5b89\u6392\u8868\u5931\u8d25:', error);
      throw error;
    }
  }

  async deleteScheduleTable(name: string) {
    try {
      const response = await apiClient.delete(`/schedule/table/${name}`);
      return response.data;
    } catch (error) {
      console.error('\u5220\u9664\u4e0b\u573a\u5b89\u6392\u8868\u5931\u8d25:', error);
      throw error;
    }
  }
}

export default new ScheduleService();
