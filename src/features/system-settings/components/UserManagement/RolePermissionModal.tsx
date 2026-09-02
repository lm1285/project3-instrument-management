import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import { ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import { PERMISSION_TREE, ROLE_TEMPLATES, getRoleTemplates, saveRoleTemplates } from '../../../../features/auth/constants/permissions';
import {
  ROLE_OPTIONS,
  collectLeafPermissionKeys,
  expandPermissionKeys,
  getRoleMeta,
} from './accessUtils';

const { Paragraph, Text } = Typography;

interface RolePermissionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
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

const RolePermissionModal: React.FC<RolePermissionModalProps> = ({ visible, onCancel, onSuccess }) => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('principal');
  const [selectedGroupKey, setSelectedGroupKey] = useState(PERMISSION_GROUPS[0]?.key || '');
  const [templates, setTemplates] = useState<Record<string, string[]>>({});
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    const currentTemplates = getRoleTemplates();
    setTemplates(currentTemplates);
    setCheckedKeys(expandPermissionKeys(currentTemplates[selectedRole] || []));
    setKeyword('');
  }, [selectedRole, visible]);

  const roleMeta = getRoleMeta(selectedRole);

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

  const checkedCount = checkedKeys.length;

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    setCheckedKeys(expandPermissionKeys(templates[role] || []));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const nextTemplates = {
        ...templates,
        [selectedRole]: checkedKeys,
      };

      saveRoleTemplates(nextTemplates);
      setTemplates(nextTemplates);
      message.success(`已保存 ${roleMeta.label} 的角色模板`);
      onSuccess();
    } catch {
      message.error('角色模板保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetCurrentRole = () => {
    const defaultPermissions = ROLE_TEMPLATES[selectedRole] || [];
    setCheckedKeys(expandPermissionKeys(defaultPermissions));
    message.success(`已恢复 ${roleMeta.label} 的默认模板`);
  };

  const handleResetAllRoles = () => {
    modal.confirm({
      title: '重置全部角色模板',
      content: '此操作会清除所有自定义角色模板，并恢复为系统默认配置。',
      okText: '确认重置',
      cancelText: '取消',
      onOk: () => {
        localStorage.removeItem('custom_role_templates');
        const defaults = getRoleTemplates();
        setTemplates(defaults);
        setCheckedKeys(expandPermissionKeys(defaults[selectedRole] || []));
        window.dispatchEvent(new Event('role-templates-changed'));
        message.success('已恢复系统默认角色模板');
        onSuccess();
      },
    });
  };

  const handleSelectAll = () => {
    setCheckedKeys(ALL_LEAF_KEYS);
  };

  const handleClearAll = () => {
    setCheckedKeys([]);
  };

  const handleApplyDefault = () => {
    setCheckedKeys(expandPermissionKeys(ROLE_TEMPLATES[selectedRole] || []));
  };

  const handleToggleGroup = (groupKey: string) => {
    const group = PERMISSION_GROUPS.find((item) => item.key === groupKey);
    if (!group) {
      return;
    }

    const groupLeafKeys = group.items.map((item) => item.key);
    const current = new Set(checkedKeys);
    const fullyChecked = groupLeafKeys.every((key) => current.has(key));

    groupLeafKeys.forEach((key) => {
      if (fullyChecked) {
        current.delete(key);
      } else {
        current.add(key);
      }
    });

    setCheckedKeys(Array.from(current));
  };

  const handleTogglePermission = (permissionKey: string, checked: boolean) => {
    const next = new Set(checkedKeys);
    if (checked) {
      next.add(permissionKey);
    } else {
      next.delete(permissionKey);
    }
    setCheckedKeys(Array.from(next));
  };

  return (
    <Modal
      title="角色权限模板"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={1360}
      style={{ top: 48 }}
      styles={{ body: { maxHeight: '74vh', overflow: 'auto' } }}
      destroyOnHidden
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="角色模板是账号权限的基线"
          description="新建账号或按模板同步权限时，会使用这里的配置。建议先维护角色模板，再做个别用户的例外授权。"
        />

        <Row gutter={16} align="stretch">
          <Col span={7}>
            <Card title="角色列表" size="small" styles={{ body: { maxHeight: 500, overflow: 'auto' } }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {ROLE_OPTIONS.map((role) => (
                  <Card
                    key={role.value}
                    size="small"
                    hoverable
                    onClick={() => handleRoleSelect(role.value)}
                    styles={{
                      body: {
                        border: selectedRole === role.value ? '1px solid #1677ff' : '1px solid transparent',
                        borderRadius: 8,
                        cursor: 'pointer',
                      },
                    }}
                  >
                    <Space direction="vertical" size={4}>
                      <Tag color={role.color}>{role.label}</Tag>
                      <Text type="secondary">{role.description}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>

          <Col span={17}>
            <Card
              title={`${roleMeta.label}模板`}
              size="small"
              extra={(
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={handleResetCurrentRole}>
                    恢复当前角色默认
                  </Button>
                  <Button danger onClick={handleResetAllRoles}>
                    重置全部模板
                  </Button>
                </Space>
              )}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索权限名称或 key"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />

                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  当前角色已选 {checkedCount} 项权限，共 {ALL_LEAF_KEYS.length} 项可配置权限。
                </Paragraph>

                <Card
                  size="small"
                  title="权限配置"
                  extra={(
                    <Space wrap>
                      <Button onClick={handleApplyDefault}>套用默认模板</Button>
                      <Button onClick={handleSelectAll}>全选</Button>
                      <Button onClick={handleClearAll}>清空</Button>
                    </Space>
                  )}
                >
                  <Space wrap style={{ marginBottom: 12 }}>
                    {PERMISSION_GROUPS.map((group) => {
                      const groupLeafKeys = group.items.map((item) => item.key);
                      const fullChecked = groupLeafKeys.every((key) => checkedKeys.includes(key));
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
                      <Card size="small" title="模块控制" styles={{ body: { maxHeight: 280, overflow: 'auto' } }}>
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          {PERMISSION_GROUPS.map((group) => {
                            const groupLeafKeys = group.items.map((item) => item.key);
                            const fullChecked = groupLeafKeys.every((key) => checkedKeys.includes(key));
                            const partialChecked = !fullChecked && groupLeafKeys.some((key) => checkedKeys.includes(key));
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
                                  onChange={() => handleToggleGroup(group.key)}
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
                        styles={{ body: { maxHeight: 280, overflow: 'auto' } }}
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
                                  checked={checkedKeys.includes(item.key)}
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
              </Space>
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onCancel}>关闭</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
            保存模板
          </Button>
        </div>
      </Space>
    </Modal>
  );
};

export default RolePermissionModal;
