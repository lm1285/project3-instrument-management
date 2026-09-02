import apiClient from '../../../services/apiClient';

export const clearCache = async () => {
  const response = await apiClient.post('/maintenance/cache/clear');
  return response.data;
};

export const analyzeDatabase = async () => {
  const response = await apiClient.post('/maintenance/database/analyze');
  return response.data;
};

export const checkIntegrity = async () => {
  const response = await apiClient.post('/maintenance/database/check');
  return response.data;
};

export const pruneLogs = async () => {
  const response = await apiClient.post('/maintenance/logs/prune');
  return response.data;
};

export const getSlowQueries = async () => {
  const response = await apiClient.get('/maintenance/slow-queries');
  return response.data;
};

// 下载备份文件的辅助函数
export const downloadBackupFile = async (filename: string) => {
    try {
      const blob = await apiClient.download(`/backup/download/${filename}`);
  
      // 创建 Blob URL
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename); // 设置下载文件名
      document.body.appendChild(link);
      link.click();
      
      // 清理
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败', error);
      throw error;
    }
  };