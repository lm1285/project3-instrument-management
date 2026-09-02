import React, { useMemo, useState } from 'react';
import { Button, Card, Col, Row, Space, Statistic } from 'antd';
import { PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import UserTable from './UserTable';
import UserForm from './UserForm';
import UserPermissionModal from './UserPermissionModal';
import RolePermissionModal from './RolePermissionModal';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import { useUserManagement } from '../../hooks/useUserManagement';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import { isCustomPermissionUser } from './accessUtils';

const UserManagement: React.FC = () => {
  const {
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
    closeForm,
    closePermissionModal,
  } = useUserManagement();

  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const summary = useMemo(() => ({
    total: users.length,
    systemAdmins: users.filter((user) => user.is_system_admin).length,
    customPermissionUsers: users.filter((user) => isCustomPermissionUser(user)).length,
  }), [users]);

  return (
    <PermissionGuard permission="system:user:view">
      <>
        <ModuleHeader
          title="用户管理"
          icon={<TeamOutlined />}
          eyebrow="User Management"
          subtitle="统一维护账号、角色模板与专属授权，角色与权限统一从权限配置入口管理。"
        />

        <Row gutter={[16, 16]} style={{ marginTop: 4, marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="账号总数" value={summary.total} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="系统管理员" value={summary.systemAdmins} prefix={<SafetyCertificateOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="自定义权限账号" value={summary.customPermissionUsers} prefix={<TeamOutlined />} />
            </Card>
          </Col>
        </Row>

        <Card
          title="账号列表"
          extra={(
            <Space wrap>
              <PermissionGuard permission="system:role:view">
                <Button onClick={() => setRoleModalVisible(true)}>
                  角色模板
                </Button>
              </PermissionGuard>
              <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
                刷新
              </Button>
              <PermissionGuard permission="system:user:add">
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  新增用户
                </Button>
              </PermissionGuard>
            </Space>
          )}
        >
          <UserTable
            loading={loading}
            users={users}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPermission={handlePermission}
          />
        </Card>

        <UserForm
          visible={formVisible}
          onCancel={closeForm}
          onSuccess={handleFormSuccess}
          editingUser={editingUser}
        />

        <UserPermissionModal
          visible={userPermissionVisible}
          onCancel={closePermissionModal}
          onSuccess={handlePermissionSuccess}
          user={permissionUser}
        />

        <RolePermissionModal
          visible={roleModalVisible}
          onCancel={() => setRoleModalVisible(false)}
          onSuccess={() => {
            window.dispatchEvent(new Event('role-templates-changed'));
            loadUsers();
          }}
        />
      </>
    </PermissionGuard>
  );
};

export default UserManagement;
