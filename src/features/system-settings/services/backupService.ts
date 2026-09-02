import apiClient from '../../../services/apiClient';

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  path: string;
}

export const getBackups = async () => {
  const response = await apiClient.get('/backup');
  return response.data as BackupFile[];
};

export const createBackup = async () => {
  const response = await apiClient.post('/backup');
  return response.data;
};

export const restoreBackup = async (filename: string) => {
  const response = await apiClient.post(`/backup/restore/${filename}`);
  return response.data;
};

export const deleteBackup = async (filename: string) => {
  const response = await apiClient.delete(`/backup/${filename}`);
  return response.data;
};

export const downloadBackupFile = async (filename: string) => {
  const blob = await apiClient.download(`/backup/download/${filename}`);
  
  // Create a link to download the file
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
