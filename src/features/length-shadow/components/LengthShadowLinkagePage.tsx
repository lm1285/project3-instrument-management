import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { PermissionGuard } from '../../auth/components/PermissionGuard';
import useAuth from '../../auth/hooks/useAuth';
import { usePermission } from '../../../hooks/usePermission';
import { DEPARTMENT_SELECT_OPTIONS } from '../../../constants/departmentOptions';
import type { LengthShadowQueryResult, LengthShadowRule, LengthShadowRulePayload } from '../types';
import {
  bulkDeleteLengthShadowRules,
  bulkImportLengthShadowRules,
  createLengthShadowRule,
  deleteLengthShadowRule,
  fetchLengthShadowRules,
  queryLengthShadowRules,
  updateLengthShadowRule,
} from '../services/lengthShadowLinkageService';
import '../../instrument-mgmt/components/InstrumentList/InstrumentList.css';
import './LengthShadowLinkagePage.css';

type QueryFormValues = {
  instrumentName: string;
  modelSpec?: string;
  templateCode?: string;
  procedureCode?: string;
};

type BatchRuleRow = {
  changeContent: string[] | string;
  targetCell: string;
  specialRuleText?: string;
  sortOrder?: number;
};

type BatchCreateFormValues = {
  department: string;
  instrumentName: string;
  modelSpec?: string;
  templateCode?: string;
  procedureCode?: string;
  enabled?: boolean;
  rows: BatchRuleRow[];
};

type SelectOpenState = Record<string, boolean>;

const CHANGE_OPTIONS = ['量程上限', '量程下限', '数显', '游标', '板厚', '壁厚'];
const TARGET_CELL_OPTIONS = ['AJ4', 'AJ8', 'AJ20'];
const RULE_HINTS = [
  '规则支持按科室隔离，不同科室只会看到自己的写入规则。',
  '日志能力已在任务台预留，这里聚焦维护模板写入规则。',
  '排序数字越小优先级越高，最高优先级建议为 1。',
];

const DEFAULT_ROW: BatchRuleRow = {
  changeContent: [],
  targetCell: '',
  specialRuleText: '',
  sortOrder: 1,
};

const IMPORT_HEADER_ALIASES: Record<string, keyof LengthShadowRulePayload> = {
  所属科室: 'department',
  仪器名称: 'instrumentName',
  型号规格: 'modelSpec',
  需要修改的内容: 'changeContent',
  对应单元格: 'targetCell',
  特殊规则说明: 'specialRuleText',
  模板编码: 'templateCode',
  规程号: 'procedureCode',
  启用: 'enabled',
  排序: 'sortOrder',
  department: 'department',
  instrumentName: 'instrumentName',
  modelSpec: 'modelSpec',
  changeContent: 'changeContent',
  targetCell: 'targetCell',
  specialRuleText: 'specialRuleText',
  templateCode: 'templateCode',
  procedureCode: 'procedureCode',
  enabled: 'enabled',
  sortOrder: 'sortOrder',
};

function parseImportedRows(rows: Record<string, unknown>[], fallbackDepartment: string) {
  return rows
    .map((row) => {
      const normalized: Record<string, unknown> = {};
      Object.entries(row || {}).forEach(([key, value]) => {
        const mappedKey = IMPORT_HEADER_ALIASES[String(key).trim()];
        if (mappedKey) {
          normalized[mappedKey] = value;
        }
      });

      return {
        department: String(normalized.department || fallbackDepartment || '').trim(),
        instrumentName: String(normalized.instrumentName || '').trim(),
        modelSpec: String(normalized.modelSpec || '').trim(),
        changeContent: String(normalized.changeContent || '').trim(),
        targetCell: String(normalized.targetCell || '').trim(),
        specialRuleText: String(normalized.specialRuleText || '').trim(),
        templateCode: String(normalized.templateCode || '').trim(),
        procedureCode: String(normalized.procedureCode || '').trim(),
        enabled: normalized.enabled === undefined
          ? true
          : ['true', '1', '是', '启用'].includes(String(normalized.enabled).trim().toLowerCase()),
        sortOrder: Number(normalized.sortOrder || 1),
      } satisfies LengthShadowRulePayload;
    })
    .filter((item) => Object.values(item).some((value) => String(value || '').trim() !== ''));
}

function downloadImportTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    {
      所属科室: '理化',
      仪器名称: '数显卡尺',
      型号规格: '0-300mm',
      需要修改的内容: '量程上限 + 数显',
      对应单元格: 'AJ8',
      特殊规则说明: '游标优先于数显；百分=0.01',
      模板编码: 'MB-LENGTH-001',
      规程号: 'JJG-001',
      排序: 1,
      启用: '是',
    },
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, '写入规则模板');
  XLSX.writeFile(workbook, '写入规则导入模板.xlsx');
}

function splitChangeContent(value?: string) {
  return String(value || '')
    .split(/[+,，\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinChangeContent(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(' + ');
  }

  return String(value || '').trim();
}

const LengthShadowLinkagePage: React.FC = () => {
  const { message } = App.useApp();
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const [editForm] = Form.useForm<LengthShadowRulePayload>();
  const [batchForm] = Form.useForm<BatchCreateFormValues>();
  const [queryForm] = Form.useForm<QueryFormValues>();
  const [records, setRecords] = useState<LengthShadowRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LengthShadowRule | null>(null);
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<LengthShadowQueryResult | null>(null);
  const [selectOpenState, setSelectOpenState] = useState<SelectOpenState>({});

  const userDepartment = String(user?.department || '').trim();
  const isSystemAdmin = Boolean(user?.is_system_admin);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchLengthShadowRules({ page, pageSize, search });
      setRecords(result.rows || []);
      setTotal(result.total || 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateDrawer = useCallback(() => {
    batchForm.resetFields();
    setSelectOpenState({});
    batchForm.setFieldsValue({
      department: isSystemAdmin ? userDepartment || '全部' : userDepartment,
      instrumentName: '',
      modelSpec: '',
      templateCode: '',
      procedureCode: '',
      enabled: true,
      rows: [{ ...DEFAULT_ROW }],
    });
    setCreateDrawerOpen(true);
  }, [batchForm, isSystemAdmin, userDepartment]);

  const openEditDrawer = useCallback((record: LengthShadowRule) => {
    setSelectOpenState({});
    setEditingRecord(record);
    editForm.setFieldsValue({
      department: record.department,
      instrumentName: record.instrumentName,
      modelSpec: record.modelSpec,
      changeContent: joinChangeContent(splitChangeContent(record.changeContent)),
      targetCell: record.targetCell,
      specialRuleText: record.specialRuleText,
      templateCode: record.templateCode,
      procedureCode: record.procedureCode,
      sortOrder: record.sortOrder,
      enabled: record.enabled,
    });
    setEditDrawerOpen(true);
  }, [editForm]);

  const getSelectFieldKey = useCallback((name: (string | number)[]) => name.map(String).join('__'), []);

  const setSelectOpen = useCallback((name: (string | number)[], open: boolean) => {
    const fieldKey = getSelectFieldKey(name);
    setSelectOpenState((previous) => ({
      ...previous,
      [fieldKey]: open,
    }));
  }, [getSelectFieldKey]);

  const closeSelectDropdown = useCallback((name: (string | number)[]) => {
    setSelectOpen(name, false);
  }, [setSelectOpen]);

  const handleBatchCreate = useCallback(async () => {
    const values = await batchForm.validateFields();
    const rows = (values.rows || []).filter((item) => joinChangeContent(item.changeContent) && String(item.targetCell || '').trim());

    if (!rows.length) {
      message.warning('请至少填写一条完整规则');
      return;
    }

    const payloads: LengthShadowRulePayload[] = rows.map((row) => ({
      department: values.department,
      instrumentName: values.instrumentName,
      modelSpec: values.modelSpec,
      changeContent: joinChangeContent(row.changeContent),
      targetCell: row.targetCell,
      specialRuleText: row.specialRuleText,
      templateCode: values.templateCode,
      procedureCode: values.procedureCode,
      sortOrder: row.sortOrder,
      enabled: values.enabled,
    }));

    setSubmitting(true);
    try {
      if (payloads.length === 1) {
        await createLengthShadowRule(payloads[0]);
      } else {
        await bulkImportLengthShadowRules(payloads);
      }
      message.success(`已新增 ${payloads.length} 条规则`);
      setCreateDrawerOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增规则失败');
    } finally {
      setSubmitting(false);
    }
  }, [batchForm, loadData, message]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingRecord) {
      return;
    }

    const values = await editForm.validateFields();
    setSubmitting(true);
    try {
      await updateLengthShadowRule(editingRecord.id, {
        ...values,
        changeContent: joinChangeContent(values.changeContent),
      });
      message.success('规则已更新');
      setEditDrawerOpen(false);
      setEditingRecord(null);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setSubmitting(false);
    }
  }, [editForm, editingRecord, loadData, message]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLengthShadowRule(id);
      message.success('规则已删除');
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  }, [loadData, message]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的规则');
      return;
    }

    try {
      await bulkDeleteLengthShadowRules(selectedRowKeys.map(String));
      message.success(`已删除 ${selectedRowKeys.length} 条规则`);
      setSelectedRowKeys([]);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '批量删除失败');
    }
  }, [loadData, message, selectedRowKeys]);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      const items = parseImportedRows(rows, userDepartment);

      if (!items.length) {
        message.warning('导入文件中没有可识别的数据');
        return Upload.LIST_IGNORE;
      }

      const result = await bulkImportLengthShadowRules(items);
      message.success(`批量导入完成：成功 ${result.successCount} 条${result.failureCount ? `，失败 ${result.failureCount} 条` : ''}`);
      if (result.errors.length) {
        message.warning(result.errors.slice(0, 3).map((item) => `第 ${item.index} 行：${item.message}`).join('；'));
      }
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导入失败');
    }

    return Upload.LIST_IGNORE;
  }, [loadData, message, userDepartment]);

  const handleQuery = useCallback(async () => {
    const values = await queryForm.validateFields();
    setQuerying(true);
    try {
      const result = await queryLengthShadowRules({
        department: userDepartment,
        ...values,
      });
      setQueryResult(result);
      if (result.matched) {
        message.success(`命中 ${result.outputs.length} 条写入规则`);
      } else {
        message.info('未匹配到规则');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '联动查询失败');
    } finally {
      setQuerying(false);
    }
  }, [message, queryForm, userDepartment]);

  const columns = useMemo(
    () => [
      {
        title: '所属科室',
        dataIndex: 'department',
        key: 'department',
        width: 120,
        render: (value: string) => <Tag>{value || '-'}</Tag>,
      },
      {
        title: '仪器名称',
        dataIndex: 'instrumentName',
        key: 'instrumentName',
        width: 180,
      },
      {
        title: '型号规格',
        dataIndex: 'modelSpec',
        key: 'modelSpec',
        width: 160,
        render: (value: string) => value || '-',
      },
      {
        title: '需要修改的内容',
        dataIndex: 'changeContent',
        key: 'changeContent',
        width: 260,
        render: (_value: string, record: LengthShadowRule) => (
          <div className="length-shadow-meta">
            {record.parsedChangeParts.length
              ? record.parsedChangeParts.map((item, index) => (
                  <Tag key={`${record.id}-${index}`} className="length-shadow-table-tag" color={item.type === 'text' ? 'blue' : 'geekblue'}>
                    {item.type === 'text' ? item.value : item.label}
                  </Tag>
                ))
              : <div>{record.changeContent || '-'}</div>}
          </div>
        ),
      },
      {
        title: '对应单元格',
        dataIndex: 'targetCell',
        key: 'targetCell',
        width: 110,
        render: (value: string) => <Tag color="purple">{value}</Tag>,
      },
      {
        title: '特殊规则',
        dataIndex: 'specialRuleText',
        key: 'specialRuleText',
        width: 220,
        render: (value: string) => value || '-',
      },
      {
        title: '模板编码',
        dataIndex: 'templateCode',
        key: 'templateCode',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '规程号',
        dataIndex: 'procedureCode',
        key: 'procedureCode',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '排序',
        dataIndex: 'sortOrder',
        key: 'sortOrder',
        width: 90,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 170,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right' as const,
        render: (_: unknown, record: LengthShadowRule) => (
          <Space size="small">
            <PermissionGuard permission="shadow_knife:rule:edit">
              <Button type="link" icon={<EditOutlined />} onClick={() => openEditDrawer(record)}>
                编辑
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="shadow_knife:rule:delete">
              <Popconfirm title="确认删除这条规则吗？" onConfirm={() => handleDelete(record.id)}>
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

  const renderChangeContentSelect = (name: (string | number)[]) => (
    <Form.Item label="需要修改的内容" name={name} rules={[{ required: true, message: '请选择需要修改的内容' }]}>
      <Select
        mode="tags"
        tokenSeparators={['+', '，', ',', '|', ';', '；']}
        options={CHANGE_OPTIONS.map((item) => ({ label: item, value: item }))}
        placeholder="请选择或输入需要修改的内容"
        className="length-shadow-select"
        open={selectOpenState[getSelectFieldKey(name)]}
        onOpenChange={(open) => setSelectOpen(name, open)}
        onChange={() => closeSelectDropdown(name)}
      />
    </Form.Item>
  );

  const renderTargetCellSelect = (name: (string | number)[], includeExtra?: string) => (
    <Form.Item label="对应单元格" name={name} rules={[{ required: true, message: '请选择对应单元格' }]}>
      <Select
        showSearch
        options={[
          ...TARGET_CELL_OPTIONS.map((item) => ({ label: item, value: item })),
          ...(includeExtra && !TARGET_CELL_OPTIONS.includes(includeExtra) ? [{ label: includeExtra, value: includeExtra }] : []),
        ]}
        placeholder="请选择对应单元格"
        className="length-shadow-select"
        optionFilterProp="label"
        open={selectOpenState[getSelectFieldKey(name)]}
        onOpenChange={(open) => setSelectOpen(name, open)}
        onChange={() => closeSelectDropdown(name)}
      />
    </Form.Item>
  );

  return (
    <PermissionGuard permission="shadow_knife:rule:view">
      <div className="instrument-workspace length-shadow-workspace">
        <section className="instrument-panel" style={{ padding: 14 }}>
          <div className="length-shadow-toolbar">
            <div className="length-shadow-toolbar__left">
              <div className="length-shadow-toolbar__title">
                <h2>写入规则</h2>
                <p>维护影刀自动化写入长度类模板的规则，并按科室隔离管理。</p>
              </div>
            </div>

            <div className="length-shadow-toolbar__right">
              <Input.Search
                allowClear
                placeholder="搜索科室、仪器名称、型号规格、单元格或特殊规则"
                className="length-shadow-search"
                enterButton={<SearchOutlined />}
                onSearch={(value) => {
                  setPage(1);
                  setSearch(value.trim());
                }}
              />
              <Button icon={<DownloadOutlined />} onClick={downloadImportTemplate}>
                下载导入模板
              </Button>
              <PermissionGuard permission="shadow_knife:rule:import">
                <Upload beforeUpload={handleImportFile} showUploadList={false} accept=".xlsx,.xls,.csv">
                  <Button icon={<UploadOutlined />}>批量导入</Button>
                </Upload>
              </PermissionGuard>
              <PermissionGuard permission="shadow_knife:rule:add">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
                  新增规则
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </section>

        <Card className="length-shadow-query-card" styles={{ body: { padding: 14 } }}>
          <Form form={queryForm} layout="vertical" initialValues={{ instrumentName: '', modelSpec: '' }}>
            <div className="length-shadow-query-grid">
              <Form.Item label="仪器名称" name="instrumentName" rules={[{ required: true, message: '请输入仪器名称' }]}>
                <Input placeholder="例如：数显卡尺" />
              </Form.Item>
              <Form.Item label="型号规格" name="modelSpec">
                <Input placeholder="例如：0-300mm" />
              </Form.Item>
              <Form.Item label="模板编码" name="templateCode">
                <Input placeholder="可选，用于提升匹配优先级" />
              </Form.Item>
              <Form.Item label="规程号" name="procedureCode">
                <Input placeholder="可选，用于提升匹配优先级" />
              </Form.Item>
            </div>

            <div className="length-shadow-query-actions">
              <Button onClick={() => setQueryResult(null)}>清空结果</Button>
              <Button type="primary" loading={querying} onClick={() => void handleQuery()}>
                试算联动查询
              </Button>
            </div>
          </Form>

          {queryResult && (
            <div className="length-shadow-query-result">
              <div className="length-shadow-query-result__header">
                <strong>{queryResult.matched ? `已匹配 ${queryResult.outputs.length} 条写入规则` : '未匹配到规则'}</strong>
                <span>{queryResult.matchStrategy}</span>
              </div>

              {queryResult.matched && (
                <div className="length-shadow-query-result__list">
                  {queryResult.outputs.map((item) => (
                    <div key={item.ruleId} className="length-shadow-query-output">
                      <div className="length-shadow-query-output__title">
                        <strong>{item.instrumentName}</strong>
                        <Tag>{item.department || userDepartment || '-'}</Tag>
                        <Tag color="purple">{item.targetCell}</Tag>
                      </div>
                      <div className="length-shadow-query-output__rows">
                        <div className="length-shadow-query-output__field">
                          <span>解析后返回内容</span>
                          <strong>{item.resolvedContent || '-'}</strong>
                        </div>
                        <div className="length-shadow-query-output__field">
                          <span>特殊规则</span>
                          <div>{item.specialRuleText || '-'}</div>
                        </div>
                        <div className="length-shadow-query-output__field">
                          <span>模板编码 / 规程号</span>
                          <div>{item.templateCode || '-'} / {item.procedureCode || '-'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Space wrap size={16}>
            <Tag color={isSystemAdmin ? 'processing' : 'default'}>
              {isSystemAdmin ? '管理员可查看全部科室规则' : `当前科室：${userDepartment || '未分配科室'}`}
            </Tag>
            {RULE_HINTS.map((item) => (
              <Tag key={item} color="processing">{item}</Tag>
            ))}
          </Space>
        </Card>

        <Card variant="borderless" className="instrument-data-card" styles={{ body: { padding: 0 } }}>
          <div className="instrument-data-card-head">
            <div>
              <div className="instrument-data-card-title">写入规则表</div>
              <div className="instrument-data-card-subtitle">
                当前共 {total} 条规则，按科室隔离显示。
              </div>
            </div>

            <Space>
              <PermissionGuard permission="shadow_knife:rule:delete">
                <Popconfirm title="确认删除已选规则吗？" onConfirm={() => void handleBulkDelete()}>
                  <Button danger disabled={!selectedRowKeys.length} icon={<DeleteOutlined />}>
                    批量删除
                  </Button>
                </Popconfirm>
              </PermissionGuard>
            </Space>
          </div>

          <div className="instrument-table-shell">
            <Table<LengthShadowRule>
              rowKey="id"
              loading={loading}
              columns={columns as any}
              dataSource={records}
              scroll={{ x: 1700 }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
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

        <Drawer
          title="新增写入规则"
          open={createDrawerOpen}
          onClose={() => setCreateDrawerOpen(false)}
          width={860}
          destroyOnHidden
          className="length-shadow-drawer instrument-management-overlay"
          extra={(
            <Space>
              <Button onClick={() => setCreateDrawerOpen(false)}>取消</Button>
              <Button
                type="primary"
                loading={submitting}
                disabled={!hasPermission('shadow_knife:rule:add')}
                onClick={() => void handleBatchCreate()}
              >
                确定
              </Button>
            </Space>
          )}
        >
          <Form
            form={batchForm}
            layout="vertical"
            initialValues={{
              department: isSystemAdmin ? userDepartment || '全部' : userDepartment,
              instrumentName: '',
              modelSpec: '',
              templateCode: '',
              procedureCode: '',
              enabled: true,
              rows: [{ ...DEFAULT_ROW }],
            }}
          >
            <div className="length-shadow-batch-item length-shadow-batch-item--shared">
              <div className="length-shadow-batch-item__grid">
                <div className="length-shadow-field-pair">
                  <Form.Item label="所属科室" name="department" rules={[{ required: true, message: '请选择所属科室' }]}>
                    <Select
                      options={DEPARTMENT_SELECT_OPTIONS}
                      disabled={!isSystemAdmin && Boolean(userDepartment)}
                      placeholder="请选择所属科室"
                    />
                  </Form.Item>

                  <Form.Item label="仪器名称" name="instrumentName" rules={[{ required: true, message: '请输入仪器名称' }]}>
                    <Input placeholder="例如：数显卡尺" />
                  </Form.Item>
                </div>

                <div className="length-shadow-field-pair">
                  <Form.Item label="型号规格" name="modelSpec">
                    <Input placeholder="例如：0-300mm" />
                  </Form.Item>

                  <Form.Item label="模板编码" name="templateCode">
                    <Input placeholder="可选" />
                  </Form.Item>
                </div>

                <div className="length-shadow-field-pair">
                  <Form.Item label="规程号" name="procedureCode">
                    <Input placeholder="可选" />
                  </Form.Item>

                  <Form.Item label="启用状态" name="enabled" valuePropName="checked">
                    <Switch checkedChildren="启用" unCheckedChildren="停用" />
                  </Form.Item>
                </div>
              </div>
            </div>

            <Form.List name="rows">
              {(fields, { add, remove }) => (
                <div className="length-shadow-batch-list">
                  {fields.map((field) => (
                    <div key={field.key} className="length-shadow-batch-item">
                      {fields.length > 1 && (
                        <div className="length-shadow-batch-item__head length-shadow-batch-item__head--actions">
                          <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)}>
                            删除该规则
                          </Button>
                        </div>
                      )}

                      <div className="length-shadow-batch-item__grid">
                        <div className="length-shadow-field-pair">
                          {renderChangeContentSelect([field.name, 'changeContent'])}
                          {renderTargetCellSelect([field.name, 'targetCell'])}
                        </div>

                        <div className="length-shadow-field-pair">
                          <Form.Item label="特殊规则" name={[field.name, 'specialRuleText']}>
                            <Input placeholder="例如：游标优先于数显" />
                          </Form.Item>

                          <Form.Item label="排序" name={[field.name, 'sortOrder']} extra="最高优先级建议为 1">
                            <InputNumber min={1} style={{ width: '100%' }} />
                          </Form.Item>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ ...DEFAULT_ROW })}>
                    再添加一条规则
                  </Button>
                </div>
              )}
            </Form.List>
          </Form>
        </Drawer>

        <Drawer
          title="编辑写入规则"
          open={editDrawerOpen}
          onClose={() => setEditDrawerOpen(false)}
          width={720}
          destroyOnHidden
          className="length-shadow-drawer instrument-management-overlay"
          extra={(
            <Space>
              <Button onClick={() => setEditDrawerOpen(false)}>取消</Button>
              <Button
                type="primary"
                loading={submitting}
                disabled={!hasPermission('shadow_knife:rule:edit')}
                onClick={() => void handleEditSubmit()}
              >
                保存
              </Button>
            </Space>
          )}
        >
          <Form form={editForm} layout="vertical">
            <div className="length-shadow-batch-item__grid">
              <div className="length-shadow-field-pair">
                <Form.Item label="所属科室" name="department" rules={[{ required: true, message: '请选择所属科室' }]}>
                  <Select
                    options={DEPARTMENT_SELECT_OPTIONS}
                    disabled={!isSystemAdmin && Boolean(userDepartment)}
                    placeholder="请选择所属科室"
                  />
                </Form.Item>

                <Form.Item label="仪器名称" name="instrumentName" rules={[{ required: true, message: '请输入仪器名称' }]}>
                  <Input />
                </Form.Item>
              </div>

              <div className="length-shadow-field-pair">
                <Form.Item label="型号规格" name="modelSpec">
                  <Input />
                </Form.Item>

                {renderChangeContentSelect(['changeContent'])}
              </div>

              <div className="length-shadow-field-pair">
                {renderTargetCellSelect(['targetCell'], editingRecord?.targetCell)}

                <Form.Item label="特殊规则" name="specialRuleText">
                  <Input />
                </Form.Item>
              </div>

              <div className="length-shadow-field-pair">
                <Form.Item label="模板编码" name="templateCode">
                  <Input />
                </Form.Item>

                <Form.Item label="规程号" name="procedureCode">
                  <Input />
                </Form.Item>
              </div>

              <div className="length-shadow-field-pair">
                <Form.Item label="排序" name="sortOrder" extra="最高优先级建议为 1">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item label="启用状态" name="enabled" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="停用" />
                </Form.Item>
              </div>
            </div>
          </Form>
        </Drawer>
      </div>
    </PermissionGuard>
  );
};

export default LengthShadowLinkagePage;
