import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { User } from '../../../types/common';
import { deleteUser, listUsers } from '../services/userService';

export const useUserManagement = () => {
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [userPermissionVisible, setUserPermissionVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionUser, setPermissionUser] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsers();
      setUsers(data as User[]);
    } catch (error: any) {
      message.error(error?.message || '用户列表加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAdd = () => {
    setEditingUser(null);
    setFormVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormVisible(true);
  };

  const handlePermission = (user: User) => {
    setPermissionUser(user);
    setUserPermissionVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('用户已删除');
      loadUsers();
    } catch (error: any) {
      message.error(error?.message || '删除用户失败');
    }
  };

  const handleFormSuccess = () => {
    setFormVisible(false);
    loadUsers();
  };

  const handlePermissionSuccess = () => {
    setUserPermissionVisible(false);
    loadUsers();
  };

  return {
    users,
    loading,
    formVisible,
    userPermissionVisible,
    editingUser,
    permissionUser,
    loadUsers,
    handleAdd,
    handleEdit,
    handlePermission,
    handleDelete,
    handleFormSuccess,
    handlePermissionSuccess,
    closeForm: () => setFormVisible(false),
    closePermissionModal: () => setUserPermissionVisible(false),
  };
};
