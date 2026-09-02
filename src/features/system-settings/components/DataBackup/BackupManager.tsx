import React, { useEffect, useState } from 'react';
import { Button, Card, Table, App, Popconfirm, Space, Tag, Form, Radio, InputNumber } from 'antd';
import { ReloadOutlined, CloudDownloadOutlined, RollbackOutlined, DeleteOutlined, CloudUploadOutlined, SaveOutlined, CloudServerOutlined } from '@ant-design/icons';
import { getBackups, createBackup, restoreBackup, deleteBackup, BackupFile } from '../../services/backupService';
import { downloadBackupFile } from '../../services/maintenanceService';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { loadGlobalSettings, saveGlobalSettings } from '../../services/systemSettingsService';
import { SystemSettings } from '../../../../types/common';
import dayjs from 'dayjs';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import { usePermission } from '../../../../hooks/usePermission';

const BackupManager: React.FC = () => {
  const { message } = App.useApp();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BackupFile[]>([]);
  const [operating, setOperating] = useState(false);
  const [settings, setSettings] = useSystemSettings();
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await getBackups();
      setData(list || []);
    } catch (error) {
      message.error('加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Only set fields if user has permission to view (and thus form is rendered)
    if (!hasPermission('system:backup:view')) return;

    if (settings.backup) {
      form.setFieldsValue(settings.backup);
    } else {
      form.setFieldsValue({
        strategy: 'manual',
        manualBackupSuggestedDays: 7,
        autoBackupDays: 7,
        retentionDays: 30,
        maxBackupCount: 30,
      });
    }
  }, [settings.backup, form, hasPermission]);

  const handleSaveSettings = async () => {
    try {
      const values = await form.validateFields();
      
      // 1. Get current global settings
      // Try to load from server, fallback to local settings if null
      const currentGlobal = await loadGlobalSettings() || settings;
      
      // 2. Merge new backup settings
      const newGlobal: SystemSettings = {
        ...currentGlobal,
        backup: {
          ...(currentGlobal.backup || {}),
          ...values
        }
      };

      // 3. Save to global settings
      const success = await saveGlobalSettings(newGlobal);
      
      if (success) {
          // 4. Update local store to reflect changes immediately
          setSettings(prev => ({
            ...prev,
            backup: {
              ...prev.backup,
              ...values
            }
          }));
          message.success('备份设置保存成功 (全局)');
      } else {
          message.error('保存全局设置失败');
      }
    } catch (error) {
      console.error(error);
      message.error('保存设置失败');
    }
  };

  const handleCreateBackup = async () => {
    setOperating(true);
    try {
      await createBackup();
      message.success('备份创建成功');
      loadData();
    } catch (error) {
      message.error('备份创建失败');
    } finally {
      setOperating(false);
    }
  };

  const handleBackupToLocal = async () => {
    setOperating(true);
    try {
      message.loading('正在创建并下载备份...', 0);
      const result = await createBackup();
      if (result && result.filename) {
          await downloadBackupFile(result.filename);
          message.destroy();
          message.success('备份已下载至本地');
          loadData();
      } else {
          message.destroy();
          message.error('创建备份失败，无法下载');
      }
    } catch (error) {
      message.destroy();
      console.error(error);
      message.error('备份下载失败');
    } finally {
      setOperating(false);
    }
  };

  const handleRestore = async (record: BackupFile) => {
    setOperating(true);
    try {
      await restoreBackup(record.filename);
      message.success('数据恢复成功');
      // 可能需要重新加载页面或登出
    } catch (error) {
      message.error('数据恢复失败');
    } finally {
      setOperating(false);
    }
  };

  const handleDelete = async (record: BackupFile) => {
    setOperating(true);
    try {
      await deleteBackup(record.filename);
      message.success('备份删除成功');
      loadData();
    } catch (error) {
      message.error('备份删除失败');
    } finally {
      setOperating(false);
    }
  };

  const handleDownload = async (record: BackupFile) => {
    try {
      await downloadBackupFile(record.filename);
      message.success('开始下载');
    } catch (error) {
      message.error('下载文件失败');
    }
  };

  const columns = [
    {
      title: '备份文件名',
      dataIndex: 'filename',
      key: 'filename',
      align: 'center' as const,
    },
    {
      title: '备份时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      align: 'center' as const,
      render: (size: number) => {
        const kb = size / 1024;
        if (kb < 1024) return `${kb.toFixed(2)} KB`;
        return `${(kb / 1024).toFixed(2)} MB`;
      },
    },
    {
      title: '操作',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: BackupFile) => (
        <Space>
          <Button 
            type="link" 
            icon={<CloudDownloadOutlined />} 
            onClick={() => handleDownload(record)}
            disabled={operating}
          >
            下载
          </Button>
          <PermissionGuard permission="system:backup:restore">
            <Popconfirm
              title="确定要恢复此备份吗？"
              description="恢复后当前数据将被覆盖，建议先创建新备份。"
              onConfirm={() => handleRestore(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" icon={<RollbackOutlined />} disabled={operating}>
                恢复
              </Button>
            </Popconfirm>
          </PermissionGuard>
          <PermissionGuard permission="system:backup:delete">
            <Popconfirm
              title="确定要删除此备份吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />} disabled={operating}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <PermissionGuard permission="system:backup:view">
    <>
      <ModuleHeader title="数据备份" icon={<CloudServerOutlined />} />
      <PermissionGuard permission="system:backup:strategy">
        <Card title="备份设置" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
            <Form.Item name="strategy" label="备份策略" initialValue="manual">
              <Radio.Group>
                <Radio value="manual">手动备份</Radio>
                <Radio value="auto">自动备份</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item noStyle shouldUpdate={(prev, current) => prev.strategy !== current.strategy}>
              {({ getFieldValue }) => {
                const strategy = getFieldValue('strategy');
                return strategy === 'auto' ? (
                  <Form.Item name="autoBackupDays" label="备份周期(天)" rules={[{ required: true }]}>
                     <InputNumber min={1} max={365} addonAfter="天" />
                  </Form.Item>
                ) : (
                  <Form.Item name="manualBackupSuggestedDays" label="建议备份间隔" rules={[{ required: true }]}>
                     <InputNumber min={1} max={365} addonAfter="天" />
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item name="retentionDays" label="备份保留天数" rules={[{ required: true }]}>
              <InputNumber min={1} max={3650} addonAfter="天" />
            </Form.Item>
            <Form.Item name="maxBackupCount" label="最多保留备份数" rules={[{ required: true }]}>
              <InputNumber min={1} max={1000} addonAfter="条" />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit">
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </PermissionGuard>

      <Card
        title="数据备份与恢复"
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData} 
              loading={loading}
            >
              刷新
            </Button>
            <PermissionGuard permission="system:backup:create">
              <Button 
                icon={<CloudDownloadOutlined />} 
                onClick={handleBackupToLocal} 
                loading={operating}
              >
                备份至本地
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="system:backup:create">
              <Button 
                type="primary" 
                icon={<CloudUploadOutlined />} 
                onClick={handleCreateBackup} 
                loading={operating}
              >
                立即备份
              </Button>
            </PermissionGuard>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="blue">说明</Tag>
          <span>备份包含系统全部业务数据（数据库、用户、模板、任务文件和操作日志等）。自动备份按设置的间隔执行，超过保留天数或数量上限时会清除最旧备份。</span>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="filename"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </>
    </PermissionGuard>
  );
};

export default BackupManager;
