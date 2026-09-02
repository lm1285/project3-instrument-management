import React, { useMemo } from 'react';
import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons';
import { User } from '../../../../types/common';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import { getRoleMeta, isCustomPermissionUser } from './accessUtils';

const { Text } = Typography;

interface UserTableProps {
  loading: boolean;
  users: User[];
  onEdit?: (user: User) => void;
  onDelete?: (id: string) => void;
  onPermission?: (user: User) => void;
}

const UserTable: React.FC<UserTableProps> = ({ loading, users, onEdit, onDelete, onPermission }) => {
  const columns = useMemo(() => [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 180,
      render: (_value: string, record: User) => (
        <Space direction="vertical" size={0}>
          <span>{record.username}</span>
          {record.is_system_admin && <Text type="secondary">系统管理员</Text>}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (_value: string, record: User) => {
        const role = record.roles?.[0] || record.role;
        const roleMeta = getRoleMeta(role);
        return <Tag color={roleMeta.color}>{roleMeta.label}</Tag>;
      },
    },
    {
      title: '所属科室',
      dataIndex: 'department',
      key: 'department',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: '权限状态',
      key: 'permissionState',
      width: 180,
      render: (_value: string, record: User) => (
        <Space wrap>
          <Tag color={isCustomPermissionUser(record) ? 'orange' : 'green'}>
            {isCustomPermissionUser(record) ? '自定义权限' : '角色模板'}
          </Tag>
          <Tag>{Array.isArray(record.permissions) ? record.permissions.length : 0} 项显式权限</Tag>
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 220,
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_value: string, record: User) => (
        <Space size="middle">
          <PermissionGuard permission="system:user:edit">
            {onEdit && (
              <Button type="link" icon={<EditOutlined />} onClick={() => onEdit(record)}>
                编辑
              </Button>
            )}
          </PermissionGuard>

          <PermissionGuard permission="system:user:perm">
            {onPermission && (
              <Button type="link" icon={<KeyOutlined />} onClick={() => onPermission(record)}>
                权限配置
              </Button>
            )}
          </PermissionGuard>

          <PermissionGuard permission="system:user:delete">
            {record.is_system_admin ? (
              <Button type="link" danger disabled icon={<DeleteOutlined />}>
                删除
              </Button>
            ) : (
              <Popconfirm
                title="确定删除该用户吗？"
                onConfirm={() => onDelete?.(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </PermissionGuard>
        </Space>
      ),
    },
  ], [onDelete, onEdit, onPermission]);

  return (
    <Table
      loading={loading}
      rowKey="id"
      dataSource={users}
      columns={columns}
      scroll={{ x: 980 }}
      pagination={{
        pageSize: 20,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条记录`,
      }}
    />
  );
};

export default UserTable;
