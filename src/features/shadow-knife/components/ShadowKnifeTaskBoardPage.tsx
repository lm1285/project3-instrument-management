import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Collapse,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PermissionGuard } from '../../auth/components/PermissionGuard';
import useAuth from '../../auth/hooks/useAuth';
import { usePermission } from '../../../hooks/usePermission';
import { DEPARTMENT_SELECT_OPTIONS } from '../../../constants/departmentOptions';
import {
  createShadowKnifeTask,
  deleteShadowKnifeTask,
  fetchShadowKnifeTasks,
  updateShadowKnifeTask,
} from '../services/shadowKnifeTaskService';
import type {
  ShadowKnifeTask,
  ShadowKnifeTaskDetail,
  ShadowKnifeTaskPayload,
  ShadowKnifeTaskSummary,
} from '../types';
import '../../instrument-mgmt/components/InstrumentList/InstrumentList.css';

const STATUS_OPTIONS = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '失败', value: 'failed' },
  { label: '跳过', value: 'skipped' },
];

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  failed: 'error',
  skipped: 'warning',
};

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  failed: '失败',
  skipped: '跳过',
};

const DETAIL_STATUS_LABEL_MAP: Record<string, string> = {
  failed: '失败',
  skipped: '跳过',
};

const DETAIL_STATUS_COLOR_MAP: Record<string, string> = {
  failed: 'error',
  skipped: 'warning',
};

const EMPTY_SUMMARY: ShadowKnifeTaskSummary = {
  taskCount: 0,
  pendingCount: 0,
  inProgressCount: 0,
  completedStatusCount: 0,
  currentRunningCount: 0,
  completedCount: 0,
  failedCount: 0,
  skippedCount: 0,
};

const ShadowKnifeTaskBoardPage: React.FC = () => {
  const { message } = App.useApp();
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const [form] = Form.useForm<ShadowKnifeTaskPayload>();
  const [records, setRecords] = useState<ShadowKnifeTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ShadowKnifeTask | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<ShadowKnifeTaskSummary>(EMPTY_SUMMARY);

  const userDepartment = String(user?.department || '').trim();
  const isSystemAdmin = Boolean(user?.is_system_admin);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
    }

    try {
      const result = await fetchShadowKnifeTasks({
        page,
        pageSize,
        search,
      });
      setRecords(result.rows || []);
      setTotal(result.total || 0);
      setSummary(result.summary || EMPTY_SUMMARY);
    } catch (error) {
      if (!silent) {
        message.error(error instanceof Error ? error.message : '加载联用任务失败');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [message, page, pageSize, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [loadData]);

  const openCreateDrawer = useCallback(() => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      department: isSystemAdmin ? userDepartment || '全部' : userDepartment,
      customerName: '',
      orderNo: '',
      startQuantity: null,
      endQuantity: null,
      status: 'pending',
      logNote: '影刀联用任务',
    });
    setDrawerOpen(true);
  }, [form, isSystemAdmin, userDepartment]);

  const openEditDrawer = useCallback((record: ShadowKnifeTask) => {
    setEditingRecord(record);
    form.setFieldsValue({
      department: record.department,
      customerName: record.customerName,
      orderNo: record.orderNo,
      startQuantity: record.startQuantity,
      endQuantity: record.endQuantity,
      status: record.status,
      logNote: record.logNote || '影刀联用任务',
    });
    setDrawerOpen(true);
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editingRecord) {
        await updateShadowKnifeTask(editingRecord.id, values);
        message.success('任务已更新');
      } else {
        await createShadowKnifeTask(values);
        message.success('任务已创建');
      }

      setDrawerOpen(false);
      setEditingRecord(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }, [editingRecord, form, loadData, message]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteShadowKnifeTask(id);
      message.success('任务已删除');
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  }, [loadData, message]);

  const detailColumns = useMemo(
    () => [
      {
        title: '当前运行数',
        dataIndex: 'currentIndex',
        key: 'currentIndex',
        width: 120,
      },
      {
        title: '证书编号',
        dataIndex: 'certificateNo',
        key: 'certificateNo',
        width: 220,
        render: (value: string) => value || '-',
      },
      {
        title: '联动状态',
        dataIndex: 'itemStatus',
        key: 'itemStatus',
        width: 140,
        render: (value: string) => (
          <Tag color={DETAIL_STATUS_COLOR_MAP[value] || 'default'}>
            {DETAIL_STATUS_LABEL_MAP[value] || value}
          </Tag>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
    ],
    [],
  );

  const columns = useMemo(
    () => [
      {
        title: '客户名称',
        dataIndex: 'customerName',
        key: 'customerName',
        width: 180,
      },
      {
        title: '单号',
        dataIndex: 'orderNo',
        key: 'orderNo',
        width: 160,
      },
      {
        title: '所属科室',
        dataIndex: 'department',
        key: 'department',
        width: 120,
        render: (value: string) => <Tag>{value || '-'}</Tag>,
      },
      {
        title: '起始数量',
        dataIndex: 'startQuantity',
        key: 'startQuantity',
        width: 120,
        render: (value: number | null) => value ?? '-',
      },
      {
        title: '结束数量',
        dataIndex: 'endQuantity',
        key: 'endQuantity',
        width: 120,
        render: (value: number | null) => value ?? '-',
      },
      {
        title: '任务状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (value: string) => (
          <Tag color={STATUS_COLOR_MAP[value] || 'default'}>
            {STATUS_LABEL_MAP[value] || value}
          </Tag>
        ),
      },
      {
        title: '当前运行数',
        dataIndex: 'currentRunningCount',
        key: 'currentRunningCount',
        width: 120,
        render: (value: number) => value ?? 0,
      },
      {
        title: '已完成数量',
        dataIndex: 'completedCount',
        key: 'completedCount',
        width: 120,
        render: (value: number) => value ?? 0,
      },
      {
        title: '失败数量',
        dataIndex: 'failedCount',
        key: 'failedCount',
        width: 120,
        render: (value: number) => value ?? 0,
      },
      {
        title: '跳过数量',
        dataIndex: 'skippedCount',
        key: 'skippedCount',
        width: 120,
        render: (value: number) => value ?? 0,
      },
      {
        title: '联动状态',
        dataIndex: 'logStatus',
        key: 'logStatus',
        width: 120,
        render: (value: string) => (
          <Tag color={value === 'synced' ? 'success' : 'warning'}>
            {value === 'synced' ? '已联动' : '待联动'}
          </Tag>
        ),
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right' as const,
        render: (_: unknown, record: ShadowKnifeTask) => (
          <Space size="small">
            <PermissionGuard permission="shadow_knife:task:edit">
              <Button type="link" icon={<EditOutlined />} onClick={() => openEditDrawer(record)}>
                编辑
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="shadow_knife:task:delete">
              <Popconfirm title="确认删除这条任务吗？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </PermissionGuard>
          </Space>
        ),
      },
    ],
    [handleDelete, openEditDrawer],
  );

  return (
    <PermissionGuard permission="shadow_knife:task:view">
      <div className="instrument-workspace">
        <section className="instrument-panel" style={{ padding: 14 }}>
          <div className="length-shadow-toolbar">
            <div className="length-shadow-toolbar__left">
              <div className="length-shadow-toolbar__title">
                <h2>联用任务台</h2>
                <p>影刀每轮回传后会自动刷新当前运行数、已完成数量、失败数量、跳过数量。异常子成员会记录证书编号和状态。</p>
              </div>
            </div>

            <div className="length-shadow-toolbar__right">
              <Input.Search
                allowClear
                placeholder="搜索客户名称、单号或科室"
                className="length-shadow-search"
                enterButton={<SearchOutlined />}
                onSearch={(value) => {
                  setPage(1);
                  setSearch(value.trim());
                }}
              />
              <PermissionGuard permission="shadow_knife:task:add">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                  新建任务
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </section>

        <Card style={{ marginBottom: 16 }}>
          <Space size={24} wrap>
            <div>
              <Typography.Text type="secondary">当前可见科室</Typography.Text>
              <div>
                <Tag color={isSystemAdmin ? 'processing' : 'default'}>
                  {isSystemAdmin ? '全部科室（管理员）' : userDepartment || '未分配科室'}
                </Tag>
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">当前运行数</Typography.Text>
              <div>{summary.currentRunningCount}</div>
            </div>
            <div>
              <Typography.Text type="secondary">已完成数量</Typography.Text>
              <div>{summary.completedCount}</div>
            </div>
            <div>
              <Typography.Text type="secondary">失败数量</Typography.Text>
              <div>{summary.failedCount}</div>
            </div>
            <div>
              <Typography.Text type="secondary">跳过数量</Typography.Text>
              <div>{summary.skippedCount}</div>
            </div>
          </Space>
        </Card>

        {!isSystemAdmin && !userDepartment ? (
          <Card>
            <Empty description="当前账号尚未分配所属科室，请先在用户管理中配置后再使用影刀联用页面。" />
          </Card>
        ) : (
          <Card variant="borderless" className="instrument-data-card" styles={{ body: { padding: 0 } }}>
            <div className="instrument-data-card-head">
              <div>
                <div className="instrument-data-card-title">联用任务明细</div>
                <div className="instrument-data-card-subtitle">
                  页面每 5 秒自动刷新一次。点开每条任务可查看失败/跳过子成员的证书编号和联动状态。
                </div>
              </div>
            </div>

            <div className="instrument-table-shell">
              <Table<ShadowKnifeTask>
                rowKey="id"
                loading={loading}
                columns={columns as any}
                dataSource={records}
                scroll={{ x: 1800 }}
                expandable={{
                  expandedRowRender: (record) => {
                    const details = (record.details || []).filter(
                      (item) => item.itemStatus === 'failed' || item.itemStatus === 'skipped',
                    );

                    if (details.length === 0) {
                      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无失败或跳过明细" />;
                    }

                    return (
                      <Collapse
                        items={[
                          {
                            key: `${record.id}-details`,
                            label: `异常子成员明细（${details.length}）`,
                            children: (
                              <Table<ShadowKnifeTaskDetail>
                                rowKey="id"
                                size="small"
                                pagination={false}
                                dataSource={details}
                                columns={detailColumns as any}
                              />
                            ),
                          },
                        ]}
                      />
                    );
                  },
                }}
                pagination={{
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  onChange: (nextPage, nextPageSize) => {
                    setPage(nextPage);
                    setPageSize(nextPageSize);
                  },
                }}
              />
            </div>
          </Card>
        )}

        <Drawer
          title={editingRecord ? '编辑联用任务' : '新建联用任务'}
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditingRecord(null);
          }}
          width={560}
          destroyOnHidden
          className="instrument-management-overlay"
          extra={(
            <Space>
              <Button
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingRecord(null);
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                loading={submitting}
                disabled={!hasPermission(editingRecord ? 'shadow_knife:task:edit' : 'shadow_knife:task:add')}
                onClick={() => void handleSubmit()}
              >
                保存
              </Button>
            </Space>
          )}
        >
          <Form form={form} layout="vertical" initialValues={{ department: userDepartment, status: 'pending' }}>
            <Form.Item
              label="所属科室"
              name="department"
              rules={[{ required: true, message: '请选择所属科室' }]}
            >
              <Select
                options={DEPARTMENT_SELECT_OPTIONS}
                disabled={!isSystemAdmin && Boolean(userDepartment)}
                placeholder="请选择所属科室"
              />
            </Form.Item>

            <Form.Item
              label="客户名称"
              name="customerName"
            >
              <Input placeholder="请输入客户名称" />
            </Form.Item>

            <Form.Item
              label="单号"
              name="orderNo"
              rules={[{ required: true, message: '请输入单号' }]}
            >
              <Input placeholder="请输入单号" />
            </Form.Item>

            <Form.Item label="起始数量" name="startQuantity">
              <InputNumber style={{ width: '100%' }} placeholder="请输入起始数量" />
            </Form.Item>

            <Form.Item label="结束数量" name="endQuantity">
              <InputNumber style={{ width: '100%' }} placeholder="请输入结束数量" />
            </Form.Item>

            <Form.Item
              label="任务状态"
              name="status"
              rules={[{ required: true, message: '请选择任务状态' }]}
            >
              <Select options={STATUS_OPTIONS} />
            </Form.Item>

            <Form.Item label="联动说明" name="logNote" extra="可填写影刀联动备注、接口说明或任务追踪信息。">
              <Input.TextArea rows={4} placeholder="请输入联动说明" />
            </Form.Item>
          </Form>
        </Drawer>
      </div>
    </PermissionGuard>
  );
};

export default ShadowKnifeTaskBoardPage;
