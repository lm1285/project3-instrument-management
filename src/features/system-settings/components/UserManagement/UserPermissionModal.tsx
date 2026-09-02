import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Radio,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import { KeyOutlined, SearchOutlined } from '@ant-design/icons';
import { updateUser } from '../../services/userService';
import { PERMISSION_TREE } from '../../../../features/auth/constants/permissions';
import {
  ROLE_OPTIONS,
  collectLeafPermissionKeys,
  expandPermissionKeys,
  getRoleMeta,
  getRoleTemplatePermissions,
  getTopLevelPermissionGroups,
  getUserPrimaryRole,
  isCustomPermissionUser,
} from './accessUtils';

const { Paragraph, Text } = Typography;

interface UserPermissionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  user: any;
}

type PermissionItem = {
  key: string;
  title: string;
  path: string[];
};

type PermissionGroup = {
  key: string;
  title: string;
  items: PermissionItem[];
};

const ALL_LEAF_KEYS = collectLeafPermissionKeys(PERMISSION_TREE);
const TOP_LEVEL_GROUPS = getTopLevelPermissionGroups(PERMISSION_TREE);

function buildPermissionGroups(): PermissionGroup[] {
  return PERMISSION_TREE.flatMap((group) => {
    if (group.key === 'system' || group.key === 'stats') {
      return (group.children || []).map((child: any) => {
        const items: PermissionItem[] = [];
        const walk = (nodes: any[], parents: string[] = []) => {
          nodes.forEach((node) => {
            const nextPath = [...parents, String(node.title)];
            if (node.children?.length) {
              walk(node.children, nextPath);
            } else {
              items.push({
                key: String(node.key),
                title: String(node.title),
                path: nextPath,
              });
            }
          });
        };
        walk(child.children || [], [String(group.title), String(child.title)]);
        return {
          key: String(child.key),
          title: String(child.title),
          items,
        };
      });
    }

    const items: PermissionItem[] = [];
    const walk = (nodes: any[], parents: string[] = []) => {
      nodes.forEach((node) => {
        const nextPath = [...parents, String(node.title)];
        if (node.children?.length) {
          walk(node.children, nextPath);
        } else {
          items.push({
            key: String(node.key),
            title: String(node.title),
            path: nextPath,
          });
        }
      });
    };

    walk(group.children || [], [String(group.title)]);
    return [{
      key: String(group.key),
      title: String(group.title),
      items,
    }];
  });
}

const PERMISSION_GROUPS = buildPermissionGroups();

const UserPermissionModal: React.FC<UserPermissionModalProps> = ({ visible, onCancel, onSuccess, user }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('engineer');
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState(PERMISSION_GROUPS[0]?.key || '');

  useEffect(() => {
    if (!visible || !user) {
      setKeyword('');
      return;
    }

    const role = getUserPrimaryRole(user);
    const templatePermissions = getRoleTemplatePermissions(role);
    const explicitPermissions = Array.isArray(user.permissions) ? user.permissions : undefined;

    setSelectedRole(role);
    setMode(explicitPermissions && isCustomPermissionUser(user) ? 'custom' : 'template');
    setCheckedKeys(expandPermissionKeys(explicitPermissions || templatePermissions));
    setKeyword('');
  }, [visible, user]);

  const templateKeys = useMemo(
    () => expandPermissionKeys(getRoleTemplatePermissions(selectedRole)),
    [selectedRole],
  );

  const roleMeta = getRoleMeta(selectedRole);
  const effectiveKeys = mode === 'template' ? templateKeys : checkedKeys;

  const selectedGroup = useMemo(
    () => PERMISSION_GROUPS.find((group) => group.key === selectedGroupKey) || PERMISSION_GROUPS[0],
    [selectedGroupKey],
  );

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return selectedGroup?.items || [];
    }

    return (selectedGroup?.items || []).filter((item) => (
      item.title.toLowerCase().includes(normalized)
      || item.key.toLowerCase().includes(normalized)
      || item.path.join('/').toLowerCase().includes(normalized)
    ));
  }, [keyword, selectedGroup]);

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    if (mode === 'template') {
      setCheckedKeys(expandPermissionKeys(getRoleTemplatePermissions(role)));
    }
  };

  const handleModeChange = (value: 'template' | 'custom') => {
    setMode(value);
    if (value === 'template') {
      setCheckedKeys(expandPermissionKeys(getRoleTemplatePermissions(selectedRole)));
    }
  };

  const handleTogglePermission = (permissionKey: string, checked: boolean) => {
    if (mode === 'template') {
      return;
    }

    const next = new Set(checkedKeys);
    if (checked) {
      next.add(permissionKey);
    } else {
      next.delete(permissionKey);
    }
    setCheckedKeys(Array.from(next));
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    setLoading(true);

    try {
      const permissionsToSave = mode === 'template'
        ? getRoleTemplatePermissions(selectedRole)
        : checkedKeys;

      await updateUser(user.id, {
        role: selectedRole,
        roles: [selectedRole],
        permissions: permissionsToSave,
      });

      message.success(`已更新 ${user.username} 的权限配置`);

      const currentUser = localStorage.getItem('user');
      if (currentUser) {
        try {
          const parsed = JSON.parse(currentUser);
          if (parsed.id === user.id || parsed.username === user.username) {
            window.dispatchEvent(new Event('auth:user-updated'));
          }
        } catch {
        }
      }

      onSuccess();
      onCancel();
    } catch (error: any) {
      message.error(error?.message || '权限更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={(
        <Space>
          <KeyOutlined />
          <span>{user?.username || '用户'}权限配置</span>
        </Space>
      )}
      open={visible}
      onCancel={onCancel}
      onOk={handleSave}
      okText="保存权限"
      cancelText="取消"
      confirmLoading={loading}
      width={1280}
      style={{ top: 48 }}
      styles={{ body: { maxHeight: '68vh', overflow: 'auto' } }}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="先选角色，再决定是否启用自定义权限"
          description="角色模板用于快速统一授权；如果某个账号需要例外权限，再切换到“自定义配置”单独勾选。"
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title="权限角色" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Radio.Group
                  value={selectedRole}
                  onChange={(event) => handleRoleChange(event.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {ROLE_OPTIONS.map((role) => (
                      <Radio key={role.value} value={role.value}>
                        {role.label}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
                <Tag color={roleMeta.color}>{roleMeta.label}</Tag>
                <Text type="secondary">{roleMeta.description}</Text>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card title="授权模式" size="small">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Radio.Group
                  value={mode}
                  onChange={(event) => handleModeChange(event.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { label: '同步角色模板', value: 'template' },
                    { label: '自定义配置', value: 'custom' },
                  ]}
                />
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {mode === 'template'
                    ? `保存后将使用“${roleMeta.label}”模板的全部权限，共 ${templateKeys.length} 项。`
                    : `当前可单独调整 ${ALL_LEAF_KEYS.length} 项权限，已选 ${checkedKeys.length} 项。`}
                </Paragraph>
                {Array.isArray(user?.permissions) && (
                  <Tag color={isCustomPermissionUser(user) ? 'orange' : 'green'}>
                    {isCustomPermissionUser(user) ? '当前为自定义权限' : '当前与角色模板一致'}
                  </Tag>
                )}
              </Space>
            </Card>

            <Card
              title="权限配置"
              size="small"
              style={{ marginTop: 16 }}
              extra={(
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索权限名称或 key"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  style={{ width: 220 }}
                  disabled={mode === 'template'}
                />
              )}
            >
              <Space wrap style={{ marginBottom: 12 }}>
                {PERMISSION_GROUPS.map((group) => {
                  const topGroup = TOP_LEVEL_GROUPS.find((item) => item.key === group.key) || TOP_LEVEL_GROUPS.find((item) => group.key.startsWith(`${item.key}:`));
                  const fullChecked = topGroup ? topGroup.leafKeys.every((key) => effectiveKeys.includes(key)) : group.items.every((item) => effectiveKeys.includes(item.key));
                  return (
                    <Tag
                      key={group.key}
                      color={fullChecked ? 'blue' : selectedGroupKey === group.key ? 'processing' : 'default'}
                      style={{ cursor: 'pointer', padding: '4px 10px' }}
                      onClick={() => setSelectedGroupKey(group.key)}
                    >
                      {group.title}
                    </Tag>
                  );
                })}
              </Space>

              <Row gutter={16}>
                <Col span={8}>
                  <Card size="small" title="模块控制" styles={{ body: { maxHeight: 260, overflow: 'auto' } }}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {PERMISSION_GROUPS.map((group) => {
                        const groupLeafKeys = group.items.map((item) => item.key);
                        const fullChecked = groupLeafKeys.every((key) => effectiveKeys.includes(key));
                        const partialChecked = !fullChecked && groupLeafKeys.some((key) => effectiveKeys.includes(key));
                        return (
                          <div
                            key={group.key}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 10px',
                              border: selectedGroupKey === group.key ? '1px solid #1677ff' : '1px solid #f0f0f0',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            onClick={() => setSelectedGroupKey(group.key)}
                          >
                            <Space size={8} style={{ minWidth: 0 }}>
                              <span>{group.title}</span>
                              <Text type="secondary">{groupLeafKeys.length} 项</Text>
                            </Space>
                            <Checkbox
                              checked={fullChecked}
                              indeterminate={partialChecked}
                              disabled={mode === 'template'}
                              onChange={() => {
                                if (mode === 'template') return;
                                const current = new Set(checkedKeys);
                                if (fullChecked) {
                                  groupLeafKeys.forEach((key) => current.delete(key));
                                } else {
                                  groupLeafKeys.forEach((key) => current.add(key));
                                }
                                setCheckedKeys(Array.from(current));
                              }}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </div>
                        );
                      })}
                    </Space>
                  </Card>
                </Col>

                <Col span={16}>
                  <Card
                    size="small"
                    title={selectedGroup?.title || '权限项'}
                    styles={{ body: { maxHeight: 260, overflow: 'auto' } }}
                  >
                    {!filteredItems.length ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配权限" />
                    ) : (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {filteredItems.map((item) => (
                          <div
                            key={item.key}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              padding: '8px 12px',
                              border: '1px solid #f0f0f0',
                              borderRadius: 8,
                            }}
                          >
                            <span>{item.title}</span>
                            <Checkbox
                              checked={effectiveKeys.includes(item.key)}
                              disabled={mode === 'template'}
                              onChange={(event) => handleTogglePermission(item.key, event.target.checked)}
                            />
                          </div>
                        ))}
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Space>
    </Modal>
  );
};

export default UserPermissionModal;
