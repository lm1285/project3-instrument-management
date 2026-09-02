import React, { useEffect, useMemo, useState } from 'react';
import { Select, Button, App, Radio } from 'antd';
import DataTable from '../../../../components/UI/DataTable';
import { generateAlerts, getAlerts, updateAlertStatus, deleteAlert as apiDeleteAlert } from '../../services/alertService';
import { getInstrumentById, updateInstrument } from '../../../../features/instrument-mgmt/services/instrumentService';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import { useSystemSettings } from '../../../../features/system-settings/hooks/useSystemSettings';
import {
  buildAlertQueryParams,
  buildGroupAlerts,
  buildProcessedAlerts,
} from './alertListUtils';

const { Option } = Select;


const AlertList: React.FC = () => {
  const { message, modal } = App.useApp();
  const [settings] = useSystemSettings();
  const [instruments, setInstruments] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'single' | 'group'>('single');
  
  // Single View Filters
  const [singleLevelFilter, setSingleLevelFilter] = useState<string>('全部');
  const [singleTypeFilter, setSingleTypeFilter] = useState<string>('全部');
  const [singleStatusFilter, setSingleStatusFilter] = useState<string>('全部');

  // Group View Filters
  const [groupLevelFilter, setGroupLevelFilter] = useState<string>('全部');
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>('全部');
  const [groupStatusFilter, setGroupStatusFilter] = useState<string>('全部');

  const [threshold] = useState<number>(() => {
    const raw = localStorage.getItem('alert_threshold_days');
    const n = raw ? parseInt(raw, 10) : 30;
    return isNaN(n) ? 30 : n;
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const navigate = useNavigate();

  const refresh = async (opts: { resetPage?: boolean; forceGenerate?: boolean } = {}) => {
    const { resetPage = false, forceGenerate = false } = opts;
    const last = parseInt(localStorage.getItem('alerts_last_generate_at') || '0', 10);
    const lastThreshold = parseInt(localStorage.getItem('alerts_last_threshold') || String(threshold), 10);
    const needGenerate = isNaN(last) || (Date.now() - last > 10 * 60 * 1000) || (lastThreshold !== threshold) || forceGenerate;
    if (needGenerate) {
      await generateAlerts(threshold);
      try {
        localStorage.setItem('alerts_last_generate_at', String(Date.now()));
        localStorage.setItem('alerts_last_threshold', String(threshold));
      } catch {}
    }
    const params: any = buildAlertQueryParams({
      viewMode,
      singleLevelFilter,
      singleTypeFilter,
      singleStatusFilter,
      groupLevelFilter,
      groupTypeFilter,
      groupStatusFilter,
      page: resetPage ? 1 : page,
      pageSize,
    });
    const res = await getAlerts(params);
    const list = (res.data as any) || [];
    setInstruments(list);
    setTotal((res as any).total || 0);
    if (resetPage) setPage(1);
  };
  useEffect(() => { refresh({ resetPage: true, forceGenerate: true }); }, []);
  useEffect(() => {
    refresh({ resetPage: true, forceGenerate: false });
  }, [singleLevelFilter, singleTypeFilter, singleStatusFilter, groupLevelFilter, groupTypeFilter, groupStatusFilter, viewMode]);
  useEffect(() => {
    const t = setInterval(() => { refresh({ resetPage: false, forceGenerate: false }); }, 60000);
    return () => clearInterval(t);
  }, [page, pageSize, singleLevelFilter, singleTypeFilter, singleStatusFilter, groupLevelFilter, groupTypeFilter, groupStatusFilter, viewMode]);

  const processedAlerts = useMemo(() => buildProcessedAlerts(instruments), [instruments]);

  const singleData = useMemo(() => {
    // Only show items that are NOT in a merge group
    return processedAlerts.filter(item => !item.raw.mergeGroupId);
  }, [processedAlerts]);

  const groupData = useMemo(() => buildGroupAlerts(processedAlerts, viewMode), [processedAlerts, viewMode]);

  const dataSource = viewMode === 'single' ? singleData : groupData;



  const updateStatus = async (row: any, newStatus: string) => {
    await updateAlertStatus(row.key, newStatus, (localStorage.getItem('username') || '系统操作员') || undefined);
    
    if (newStatus === '已送检') {
       try {
         const currentUser = (localStorage.getItem('username') || '系统操作员');
         const instrumentId = row.raw.instrumentId;
         if (instrumentId) {
            await updateInstrument(instrumentId, {
                status: '停用',
                disableReason: '送检中',
                disabler: currentUser,
                disableTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
            });
            message.info('仪器状态已自动更新为"停用" (送检中)');
         }
       } catch (e) {
         console.error('Auto-disable failed', e);
       }
    }

    if (newStatus === '溯源确认') {
        const templates = settings.templates || [];
        const template = templates.find((t: any) => t.relatedFunction === '预警总览-溯源确认');
        
        if (template && template.type === 'Excel模板' && template.fileData) {
            try {
                const instrumentId = row.raw.instrumentId;
                if (instrumentId) {
                    const res = await getInstrumentById(instrumentId);
                    if (res.success && res.data) {
                        // Handle Data URI prefix if present
                        const fileContent = template.fileData.includes(',') 
                            ? template.fileData.split(',')[1] 
                            : template.fileData;
                        
                        // Load the zip file
                        const zip = await JSZip.loadAsync(fileContent, { base64: true });
                        const data = res.data as any;

                        // Helper for XML escaping
                        const escapeXml = (unsafe: string) => {
                            return unsafe.replace(/[<>&'"]/g, (c) => {
                                switch (c) {
                                    case '<': return '&lt;';
                                    case '>': return '&gt;';
                                    case '&': return '&amp;';
                                    case '\'': return '&apos;';
                                    case '"': return '&quot;';
                                    default: return c;
                                }
                            });
                        };

                        // 1. Process sharedStrings.xml (where most text lives)
                        const sharedStringsFile = zip.file("xl/sharedStrings.xml");
                        if (sharedStringsFile) {
                            let content = await sharedStringsFile.async("string");
                            content = content.replace(/\{\{(.+?)\}\}/g, (_match: string, p1: string) => {
                                const fieldKey = p1.trim();
                                const val = data[fieldKey];
                                return val !== undefined ? escapeXml(String(val)) : '';
                            });
                            zip.file("xl/sharedStrings.xml", content);
                        }

                        // 2. Process all sheet XMLs (in case of inline strings)
                        const sheetFiles = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/);
                        for (const file of sheetFiles) {
                            let content = await file.async("string");
                            // Look for inline strings: <is><t>...</t></is> or simply replace any occurrence in the XML
                            // A global replace is safe enough for {{key}} patterns as they are unlikely to appear in tags
                            if (content.includes('{{')) {
                                content = content.replace(/\{\{(.+?)\}\}/g, (_match: string, p1: string) => {
                                    const fieldKey = p1.trim();
                                    const val = data[fieldKey];
                                    return val !== undefined ? escapeXml(String(val)) : '';
                                });
                                zip.file(file.name, content);
                            }
                        }
                        
                        // Generate blob and download
                        const blob = await zip.generateAsync({ type: "blob" });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `溯源确认_${data.name || '仪器'}_${dayjs().format('YYYYMMDD')}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        
                        message.success('已生成溯源确认单');
                    } else {
                        message.error('获取仪器信息失败');
                    }
                }
            } catch (error) {
                console.error('Template generation failed:', error);
                message.error('模板生成失败: ' + (error instanceof Error ? error.message : String(error)));
            }
        } else {
            message.warning('未找到"溯源确认"Excel模板，请在系统设置中配置');
        }
    }

    if (newStatus === '更新信息') {
      modal.confirm({
        title: '确认更新该仪器信息',
        okText: '确认',
        cancelText: '取消',
        onOk: () => {
          localStorage.setItem('editInstrumentManagementNumber', row.managementNumber || '');
          localStorage.setItem('editIntent', 'alertUpdate');
          navigate('/instrument-mgmt');
        }
      });
    } else {
      if (newStatus !== '溯源确认') {
          message.success('处理状态已更新');
      }
    }
    refresh();
  };

  const confirmUpdateStatus = (row: any, newStatus: string) => {
    modal.confirm({
      title: '确认修改状态',
      content: `确定将处理状态修改为"${newStatus}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => updateStatus(row, newStatus)
    });
  };

  const deleteAlert = async (row: any) => {
    await apiDeleteAlert(row.key);
    message.success('预警已删除');
    refresh();
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} buttonStyle="solid">
          <Radio.Button value="single">单个显示</Radio.Button>
          <Radio.Button value="group">合并组显示</Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span>预警级别</span>
        <Select 
          value={viewMode === 'single' ? singleLevelFilter : groupLevelFilter} 
          onChange={viewMode === 'single' ? setSingleLevelFilter : setGroupLevelFilter} 
          style={{ width: 120 }}
        >
          <Option value="全部">全部</Option>
          <Option value="超期">超期</Option>
          <Option value="预到期">预到期</Option>
          <Option value="库存不足">库存不足</Option>
        </Select>
        <span>类型</span>
        <Select 
          value={viewMode === 'single' ? singleTypeFilter : groupTypeFilter} 
          onChange={viewMode === 'single' ? setSingleTypeFilter : setGroupTypeFilter} 
          style={{ width: 120 }}
        >
          <Option value="全部">全部</Option>
          <Option value="标准器">标准器</Option>
          <Option value="标准物质">标准物质</Option>
          <Option value="辅助设备">辅助设备</Option>
        </Select>
        <span>处理状态</span>
        <Select 
          value={viewMode === 'single' ? singleStatusFilter : groupStatusFilter} 
          onChange={viewMode === 'single' ? setSingleStatusFilter : setGroupStatusFilter} 
          style={{ width: 120 }}
        >
          <Option value="全部">全部</Option>
          <Option value="预警">预警</Option>
          <Option value="已提交质量">已提交质量</Option>
          <Option value="已送检">已送检</Option>
          <Option value="更新信息">更新信息</Option>
        </Select>

      </div>
      {viewMode === 'group' ? (
        <DataTable
          dataSource={groupData}
          rowKey="key"
          pagination={true}
          pageSize={20}
          // For group view, we use client-side pagination of the groups derived from current data
          // So we do NOT pass the server total, letting DataTable use dataSource.length
          // total={groupData.length} // explicit total for client side
          columns={[
            { title: '预警级别', dataIndex: 'level', key: 'level', align: 'center', width: 100, render: (v: string) => <span style={{ color: v === '紧急' ? 'red' : v === '重要' ? 'orange' : 'black' }}>{v}</span> },
            { title: '上级组名称', dataIndex: 'name', key: 'name', align: 'center', width: 150 },
            { title: '上级组型号规格', dataIndex: 'model', key: 'model', align: 'center', width: 150 },
            { title: '上级组测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center', width: 150 },
            { title: '总当前容量', key: 'totalCurrent', align: 'center', width: 120, render: (_: any, r: any) => `${r.totalCurrent}${r.unit||''}` },
            { title: '总初始容量', key: 'totalInitial', align: 'center', width: 120, render: (_: any, r: any) => `${r.totalInitial}${r.unit||''}` },
            { title: '数量', dataIndex: 'count', key: 'count', align: 'center', width: 80 }
          ]}
          tableId="alert-group-table"
          expandable={{
            expandedRowRender: (record: any) => (
              <div style={{ padding: '8px 16px', background: '#fafafa' }}>
                <DataTable
                  dataSource={record.list}
                  pagination={true}
                  pageSize={20}
                  // Inner table is fully client-side (record.list is in memory)
                  // So we do not pass total (or pass list.length)
                  // total={record.list?.length || 0} 
                  rowKey="key"
                  columns={[
                    { title: '预警级别', dataIndex: 'level', key: 'level', align: 'center', width: 100 },
                    { title: '仪器类型', dataIndex: 'type', key: 'type', align: 'center', width: 100 },
                    { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center', width: 150 },
                    { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center', width: 150 },
                    { title: '出厂编号', dataIndex: 'serialNumber', key: 'serialNumber', align: 'center', width: 150 },
                    { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center', width: 150 },
                    { title: '测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center', width: 150 },
                    { title: '复校日期', dataIndex: 'nextCalibrationDate', key: 'nextCalibrationDate', align: 'center', width: 120, render: (text: any) => text ? dayjs(text).tz().format('YYYY-MM-DD') : '' },
                    { title: '剩余天数', dataIndex: 'remainingDays', key: 'remainingDays', align: 'center', width: 100 },
                    { title: '当前容量', key: 'currentCapacity', align: 'center', width: 100, render: (_: any, r: any) => (r.currentCapacity !== undefined && r.currentCapacity !== null && r.currentCapacity !== '') ? `${r.currentCapacity}${r.unit||''}` : '-' },
                    { title: '初始容量', key: 'initialCapacity', align: 'center', width: 100, render: (_: any, r: any) => (r.initialCapacity !== undefined && r.initialCapacity !== null && r.initialCapacity !== '') ? `${r.initialCapacity}${r.unit||''}` : '-' },
                    { title: '处理状态', key: 'status', align: 'center', width: 150, render: (_: any, row: any) => (
                        <PermissionGuard permission="dashboard:alert:process" fallback={<span>{row.status}</span>}>
                          <Select value={row.status} onChange={(v) => confirmUpdateStatus(row, v)} style={{ width: 120 }}>
                            <Option value="预警">预警</Option>
                            <Option value="已提交质量">已提交质量</Option>
                            <Option value="已送检">已送检</Option>
                            <Option value="更新信息">更新信息</Option>
                            <Option value="溯源确认">溯源确认</Option>
                            <Option value="已完成">已完成</Option>
                          </Select>
                        </PermissionGuard>
                      ) 
                    },
                    { title: '操作', key: 'op', align: 'center', width: 100, render: (_: any, row: any) => (
                        <PermissionGuard permission="dashboard:alert:delete">
                          <Button danger size="small" onClick={() => deleteAlert(row)}>删除</Button>
                        </PermissionGuard>
                      ) 
                    }
                  ]}
                  tableId="alert-group-detail-table"
                />
              </div>
            )
          }}
        />
      ) : (
      <DataTable
        dataSource={dataSource}
        pagination={true}
        pageSize={pageSize}
        currentPage={page}
        total={total}
        onPageChange={(p, ps) => { setPage(p); setPageSize(ps); refresh({ resetPage: false, forceGenerate: false }); }}
        columns={[
          { title: '预警级别', dataIndex: 'level', key: 'level', align: 'center', width: 100 },
          { title: '仪器类型', dataIndex: 'type', key: 'type', align: 'center', width: 100 },
          { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center', width: 150 },
          { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center', width: 150 },
          { title: '出厂编号', dataIndex: 'serialNumber', key: 'serialNumber', align: 'center', width: 150 },
          { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center', width: 150 },
          { title: '测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center', width: 150 },
          { title: '复校日期', dataIndex: 'nextCalibrationDate', key: 'nextCalibrationDate', align: 'center', width: 120, render: (text: any) => text ? dayjs(text).tz().format('YYYY-MM-DD') : '' },
          { title: '剩余天数', dataIndex: 'remainingDays', key: 'remainingDays', align: 'center', width: 100 },
          { title: '当前容量', key: 'currentCapacity', align: 'center', width: 100, render: (_: any, r: any) => (r.currentCapacity !== undefined && r.currentCapacity !== null && r.currentCapacity !== '') ? `${r.currentCapacity}${r.unit||''}` : '-' },
          { title: '初始容量', key: 'initialCapacity', align: 'center', width: 100, render: (_: any, r: any) => (r.initialCapacity !== undefined && r.initialCapacity !== null && r.initialCapacity !== '') ? `${r.initialCapacity}${r.unit||''}` : '-' },
          { title: '处理状态', key: 'status', align: 'center', width: 150, render: (_: any, row: any) => (
            <PermissionGuard permission="dashboard:alert:process" fallback={<span>{row.status}</span>}>
            <Select value={row.status} onChange={(v) => confirmUpdateStatus(row, v)} style={{ width: 120 }}>
              <Option value="预警">预警</Option>
              <Option value="已提交质量">已提交质量</Option>
              <Option value="已送检">已送检</Option>
              <Option value="更新信息">更新信息</Option>
              <Option value="溯源确认">溯源确认</Option>
              <Option value="已完成">已完成</Option>
            </Select>
            </PermissionGuard>
          ) },
          { title: '操作', key: 'op', align: 'center', width: 100, render: (_: any, row: any) => (
            <PermissionGuard permission="dashboard:alert:delete">
              <Button danger size="small" onClick={() => deleteAlert(row)}>删除</Button>
            </PermissionGuard>
          ) }
        ]}
        rowKey="key"
        tableId="alert-single-table"
      />
      )}
    </div>
  );
};

export default AlertList;
