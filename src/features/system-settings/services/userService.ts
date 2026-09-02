import apiClient from '../../../services/apiClient';

export async function createUser(payload: { username: string; password: string; role: string; department?: string }) {
  const res = await apiClient.post('/users', payload);
  if (!res.success) {
    throw new Error(res.message || '创建用户失败');
  }

  return res.data as { id: string; username: string; role: string; department?: string };
}

export async function listUsers() {
  const res = await apiClient.get('/users', { disableCache: true });
  if (!res.success) {
    throw new Error(res.message || '获取用户列表失败');
  }

  const data = (res.data as any)?.data || res.data;
  return data as { id: string; username: string; role: string; created_at: string; department?: string; name?: string }[];
}

export async function updateUser(
  id: string,
  payload: Partial<{
    username: string;
    role: string;
    roles: string[];
    password: string;
    permissions: string[];
    name: string;
    department: string;
  }>,
) {
  const res = await apiClient.put(`/users/${id}`, payload);
  if (!res.success) {
    throw new Error(res.message || '更新用户失败');
  }

  return res.data;
}

export async function deleteUser(id: string) {
  const res = await apiClient.delete(`/users/${id}`);
  if (!res.success) {
    throw new Error(res.message || '删除用户失败');
  }

  return res.data;
}
