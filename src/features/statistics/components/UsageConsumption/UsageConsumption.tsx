import React, { useEffect, useState, useMemo } from 'react'
import { Card, Space, Select, DatePicker, Input, Button, App, Tabs, Modal, Form, Popconfirm } from 'antd'
import { DownloadOutlined, LineChartOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useSystemSettings } from '../../../system-settings/hooks/useSystemSettings'
import { PermissionGuard } from '../../../auth/components/PermissionGuard'
import { InstrumentType } from '../../../../constants/instrument'
import apiClient from '../../../../services/apiClient'
import DataTable from '../../../../components/UI/DataTable'
import { InstrumentTableColumn } from '../../../../components/UI/InstrumentTableColumns'
import DetailModal from '../../../instrument-flow/components/OperationModals/DetailModal'
import ModuleHeader from '../../../../components/UI/ModuleHeader'
import {
  buildExportConfig,
  buildHistoryRequestParams,
  exportRowsToCSV,
  type UsageFilters,
} from './usageConsumptionUtils'

const { RangePicker } = DatePicker

const UsageConsumptionContent: React.FC = () => {
  const { message: messageApi } = App.useApp()
  const [settings] = useSystemSettings()
  const [activeTab, setActiveTab] = useState<string>('usage')
  
  // Shared Filters State
  const [range, setRange] = useState<[string, string]>([dayjs().subtract(30, 'day').startOf('day').toISOString(), dayjs().endOf('day').toISOString()])
  const [filterType, setFilterType] = useState<string>('全部')
  const [filterAction, setFilterAction] = useState<string>('全部')
  const [filterDept, setFilterDept] = useState<string>('')
  const [filterUser, setFilterUser] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')
  
  // Usage Records State
  const [usageData, setUsageData] = useState<any[]>([])
  const [usageTotal, setUsageTotal] = useState<number>(0)
  const [usagePage, setUsagePage] = useState<number>(1)

  // Used Records State
  const [usedData, setUsedData] = useState<any[]>([])
  const [usedTotal, setUsedTotal] = useState<number>(0)
  const [usedPage, setUsedPage] = useState<number>(1)

  // Disabled Records State
  const [disabledData, setDisabledData] = useState<any[]>([])
  const [disabledTotal, setDisabledTotal] = useState<number>(0)
  const [disabledPage, setDisabledPage] = useState<number>(1)

  // Standard Material Usage State
  const [materialData, setMaterialData] = useState<any[]>([])
  const [materialTotal, setMaterialTotal] = useState<number>(0)
  const [materialPage, setMaterialPage] = useState<number>(1)

  // LIMS Records State
  const [limsData, setLimsData] = useState<any[]>([])
  const [limsTotal, setLimsTotal] = useState<number>(0)
  const [limsPage, setLimsPage] = useState<number>(1)

  const [loading, setLoading] = useState<boolean>(false)

  // Modals State
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedInstrument, setSelectedInstrument] = useState<any>(null)

  const [remarkEditVisible, setRemarkEditVisible] = useState(false)
  const [remarkEditRecord, setRemarkEditRecord] = useState<any>(null)
  const [remarkForm] = Form.useForm()

  const usageFilters = useMemo<UsageFilters>(() => ({
    range,
    filterType,
    filterAction,
    filterDept,
    filterUser,
    keyword,
  }), [range, filterType, filterAction, filterDept, filterUser, keyword])

  // Generic Fetch Function
  const fetchHistoryData = async (
    endpoint: string,
    customParams: Record<string, string | undefined>,
    setData: (data: any[]) => void,
    setTotal: (total: number) => void,
    setPage: (page: number) => void,
    page: number,
    errorMessageStr: string
  ) => {
    setLoading(true)

    try {
      const resp = await apiClient.get(endpoint, { 
        params: buildHistoryRequestParams(usageFilters, customParams, page, settings.table?.pageSize ?? 20),
        disableCache: true 
      })
      if (resp.success) {
        setData(Array.isArray(resp.data) ? resp.data : [])
        setTotal((resp as any).total || 0)
      } else {
        setData([])
        setTotal(0)
      }
    } catch (e) {
      console.error(e)
      messageApi.error(errorMessageStr)
    } finally {
      setLoading(false)
      setPage(page)
    }
  }

  // Fetch Usage Records (Standard Instruments & Auxiliary Equipment)
  const fetchUsage = async (page = 1) => {
    const params: Record<string, string | undefined> = {
      start: range[0],
      end: range[1],
      actions: filterAction !== '全部' ? filterAction : 'out,in',
    }

    if (filterType !== '全部') {
      params.type = filterType
    } else {
      params.types = `${InstrumentType.STANDARD_DEVICE},${InstrumentType.AUXILIARY_DEVICE}`
    }

    await fetchHistoryData(
      '/history/usage',
      params,
      setUsageData,
      setUsageTotal,
      setUsagePage,
      page,
      '获取使用记录失败'
    )
  }

  // Fetch Standard Material Usage Records (Check-in only)
  const fetchMaterialUsage = async (page = 1) => {
    const params: Record<string, string | undefined> = {
      start: range[0],
      end: range[1],
      type: InstrumentType.STANDARD_MATERIAL,
      actions: 'in,out'
    }

    await fetchHistoryData(
      '/history/usage',
      params,
      setMaterialData,
      setMaterialTotal,
      setMaterialPage,
      page,
      '获取标准物质记录失败'
    )
  }

  // Fetch Used Records (Capacity Exhausted)
  const fetchUsed = async (page = 1) => {
    const params: Record<string, string | undefined> = {}
    if (filterType !== '全部') params.type = filterType
    
    await fetchHistoryData(
      '/history/used',
      params,
      setUsedData,
      setUsedTotal,
      setUsedPage,
      page,
      '获取已使用记录失败'
    )
  }

  // Fetch Disabled Records
  const fetchDisabled = async (page = 1) => {
    const params: Record<string, string | undefined> = {
      start: range[0],
      end: range[1]
    }
    if (filterType !== '全部') params.type = filterType

    await fetchHistoryData(
      '/history/disabled',
      params,
      setDisabledData,
      setDisabledTotal,
      setDisabledPage,
      page,
      '获取停用记录失败'
    )
  }

  // Fetch LIMS Records
  const fetchLims = async (page = 1) => {
    await fetchHistoryData(
        '/statistics/lims-records',
        { keyword },
        setLimsData,
        setLimsTotal,
        setLimsPage,
        page,
        '获取LIMS记录失败'
    )
  }

  useEffect(() => {
    if (activeTab === 'usage') fetchUsage(1)
    else if (activeTab === 'materialUsage') fetchMaterialUsage(1)
    else if (activeTab === 'used') fetchUsed(1)
    else if (activeTab === 'disabled') fetchDisabled(1)
    else if (activeTab === 'lims') fetchLims(1)
  }, [activeTab, range, filterType, filterAction, filterDept, filterUser])

  useEffect(() => {
    const t = setTimeout(() => {
        if (activeTab === 'usage') fetchUsage(1)
        else if (activeTab === 'materialUsage') fetchMaterialUsage(1)
        else if (activeTab === 'used') fetchUsed(1)
        else if (activeTab === 'disabled') fetchDisabled(1)
        else if (activeTab === 'lims') fetchLims(1)
    }, 500)
    return () => clearTimeout(t)
  }, [keyword])


  const formatNumber = (n: any) => {
    const dec = settings.numberFormat?.decimals ?? 2
    const useSep = settings.numberFormat?.thousandSeparator ?? true
    const num = Number(n)
    if (!isFinite(num)) return String(n ?? '')
    
    return num.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      useGrouping: useSep
    })
  }

  const handleExport = async () => {
    setLoading(true)
    try {
      const { endpoint, filename, columns, params } = buildExportConfig(
        activeTab,
        usageFilters,
        usageColumns,
        materialColumns,
        usedColumns,
        disabledColumns,
      )
      params.set('page', '1')
      params.set('pageSize', '10000') // Get all
      
      const resp = await apiClient.get(endpoint, { params: Object.fromEntries(params.entries()) })
      if (resp.success && Array.isArray(resp.data)) {
        exportRowsToCSV(resp.data, columns, filename, fullFormat, formatNumber)
        messageApi.success('导出成功')
      } else {
        messageApi.error('导出失败: 无数据')
      }
    } catch (e) {
      console.error(e)
      messageApi.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  // Handlers
  const handleViewDetail = (record: any, type: 'usage' | 'materialUsage' | 'used' | 'disabled') => {
    const instrumentId = (type === 'usage' || type === 'materialUsage') ? record.instrumentId : record.id
    setSelectedInstrument({ id: instrumentId })
    setDetailVisible(true)
  }

  const handleDelete = async (id: string, type: 'usage' | 'materialUsage' | 'used' | 'disabled') => {
    try {
      const apiType = (type === 'usage' || type === 'materialUsage') ? 'usage' : type
      await apiClient.delete(`/history/${apiType}/${id}`)
      messageApi.success('删除成功')
      if (type === 'usage') fetchUsage(usagePage)
      else if (type === 'materialUsage') fetchMaterialUsage(materialPage)
      else if (type === 'used') fetchUsed(usedPage)
      else fetchDisabled(disabledPage)
    } catch (e) {
      messageApi.error('删除失败')
    }
  }

  const handleEdit = (record: any) => {
    setRemarkEditRecord(record)
    setRemarkEditVisible(true)
  }

  useEffect(() => {
    if (remarkEditVisible && remarkEditRecord) {
      if (activeTab === 'disabled') {
        remarkForm.setFieldsValue({
          status: remarkEditRecord.instrumentStatus || remarkEditRecord.status || '停用',
          inOutStatus: remarkEditRecord.storageStatus || remarkEditRecord.inOutStatus || '入库',
          remarks: remarkEditRecord.remarks || ''
        })
      } else {
        remarkForm.setFieldsValue({
          remarks: remarkEditRecord.remarks || ''
        })
      }
    }
  }, [remarkEditVisible, remarkEditRecord, activeTab, remarkForm])

  const handleEditSubmit = async () => {
    try {
      const values = await remarkForm.validateFields()
      let endpoint = ''
      if (activeTab === 'usage' || activeTab === 'materialUsage') {
        endpoint = `/history/usage/${remarkEditRecord.id}/remarks`
      } else if (activeTab === 'used') {
        endpoint = `/history/used/${remarkEditRecord.id}/remarks`
      } else {
        endpoint = `/history/disabled/${remarkEditRecord.id}`
      }

      await apiClient.put(endpoint, values)
      messageApi.success('更新成功')
      setRemarkEditVisible(false)
      
      if (activeTab === 'usage') fetchUsage(usagePage)
      else if (activeTab === 'materialUsage') fetchMaterialUsage(materialPage)
      else if (activeTab === 'used') fetchUsed(usedPage)
      else fetchDisabled(disabledPage)
    } catch (e) {
      console.error(e)
      messageApi.error('更新失败')
    }
  }

  const dateFormat = settings.localization?.dateFormat || 'YYYY-MM-DD'
  // Force a standard time format if the setting is weird or missing
  const timeFormat = settings.localization?.timeFormat && settings.localization.timeFormat.includes(':') 
    ? settings.localization.timeFormat 
    : 'HH:mm:ss';
  const fullFormat = `${dateFormat} ${timeFormat}`

  const usageColumns: InstrumentTableColumn[] = useMemo(() => [
    { title: '仪器名称', key: 'name', dataIndex: 'name', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '型号规格', key: 'model', dataIndex: 'model', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '管理编号', key: 'managementNumber', dataIndex: 'managementNumber', align: 'center', width: 120, resizable: true, draggable: true },
    { title: '操作类型', key: 'actionType', dataIndex: 'action', align: 'center', width: 100, resizable: true, draggable: true, render: (val: string) => {
      const map: Record<string, string> = { 'use': '使用', 'out': '出库', 'in': '入库' };
      return map[val] || val;
    } },
    { title: '操作人', key: 'operator', dataIndex: 'operator', align: 'center', width: 100, resizable: true, draggable: true },
    { title: '操作时间', key: 'time', dataIndex: 'time', align: 'center', width: 160, resizable: true, draggable: true, render: (t: any) => dayjs(t).isValid() ? dayjs(t).format(fullFormat) : '-' },
    { title: '备注', key: 'remarks', dataIndex: 'remarks', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '操作', key: 'action', align: 'center', width: 180, fixed: 'right', render: (_: any, record: any) => (
      <Space>
        <PermissionGuard permission="stats:usage:view">
          <Button type="link" size="small" onClick={() => handleViewDetail(record, 'usage')}>查看</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:edit">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:delete">
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id, 'usage')} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </PermissionGuard>
      </Space>
    ) }
  ], [fullFormat, settings])

  const materialColumns: InstrumentTableColumn[] = useMemo(() => [
    { title: '仪器名称', key: 'name', dataIndex: 'name', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '型号规格', key: 'model', dataIndex: 'model', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '管理编号', key: 'managementNumber', dataIndex: 'managementNumber', align: 'center', width: 120, resizable: true, draggable: true },
    { title: '操作类型', key: 'actionType', dataIndex: 'action', align: 'center', width: 100, resizable: true, draggable: true, render: (val: string) => {
      const map: Record<string, string> = { 'use': '使用', 'out': '出库', 'in': '入库' };
      return map[val] || val;
    } },
    { title: '操作人', key: 'operator', dataIndex: 'operator', align: 'center', width: 100, resizable: true, draggable: true },
    { title: '操作时间', key: 'time', dataIndex: 'time', align: 'center', width: 160, resizable: true, draggable: true, render: (t: any) => dayjs(t).isValid() ? dayjs(t).format(fullFormat) : '-' },
    { title: '出/入库容量', key: 'delta', dataIndex: 'delta', align: 'center', width: 100, resizable: true, draggable: true, render: (v: any, r: any) => v ? `${formatNumber(v)} ${r.unit || ''}` : '-' },
    { title: '备注', key: 'remarks', dataIndex: 'remarks', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '操作', key: 'action', align: 'center', width: 180, fixed: 'right', render: (_: any, record: any) => (
      <Space>
        <PermissionGuard permission="stats:usage:view">
          <Button type="link" size="small" onClick={() => handleViewDetail(record, 'materialUsage')}>查看</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:edit">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:delete">
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id, 'materialUsage')} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </PermissionGuard>
      </Space>
    ) }
  ], [fullFormat, settings])

  const usedColumns: InstrumentTableColumn[] = useMemo(() => [
    { title: '仪器名称', key: 'name', dataIndex: 'name', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '型号规格', key: 'model', dataIndex: 'model', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '管理编号', key: 'managementNumber', dataIndex: 'managementNumber', align: 'center', width: 120, resizable: true, draggable: true },
    { title: '最后使用时间', key: 'lastUsageTime', dataIndex: 'lastUsageTime', align: 'center', width: 160, resizable: true, draggable: true, render: (t: any) => dayjs(t).isValid() ? dayjs(t).format(fullFormat) : '-' },
    { title: '初始容量', key: 'initialCapacity', dataIndex: 'initialCapacity', align: 'center', width: 120, resizable: true, draggable: true, render: (v: any, r: any) => v ? `${formatNumber(v)} ${r.unit || ''}` : '-' },
    { title: '备注', key: 'remarks', dataIndex: 'remarks', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '操作', key: 'action', align: 'center', width: 180, fixed: 'right', render: (_: any, record: any) => (
      <Space>
        <PermissionGuard permission="stats:usage:view">
          <Button type="link" size="small" onClick={() => handleViewDetail(record, 'used')}>查看</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:edit">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:delete">
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id, 'used')} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </PermissionGuard>
      </Space>
    ) }
  ], [fullFormat, settings])

  const disabledColumns: InstrumentTableColumn[] = useMemo(() => [
    { title: '仪器名称', key: 'name', dataIndex: 'name', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '型号规格', key: 'model', dataIndex: 'model', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '管理编号', key: 'managementNumber', dataIndex: 'managementNumber', align: 'center', width: 120, resizable: true, draggable: true },
    { title: '停用时间', key: 'disableTime', dataIndex: 'disableTime', align: 'center', width: 160, resizable: true, draggable: true, render: (t: any) => dayjs(t).isValid() ? dayjs(t).format(fullFormat) : '-' },
    { title: '停用原因', key: 'disableReason', dataIndex: 'disableReason', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '停用人', key: 'disabler', dataIndex: 'disabler', align: 'center', width: 100, resizable: true, draggable: true },
    { title: '备注', key: 'remarks', dataIndex: 'remarks', align: 'center', width: 150, resizable: true, draggable: true },
    { title: '操作', key: 'action', align: 'center', width: 180, fixed: 'right', render: (_: any, record: any) => (
      <Space>
        <PermissionGuard permission="stats:usage:view">
          <Button type="link" size="small" onClick={() => handleViewDetail(record, 'disabled')}>查看</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:edit">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
        </PermissionGuard>
        <PermissionGuard permission="stats:usage:delete">
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id, 'disabled')}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </PermissionGuard>
      </Space>
    ) }
  ], [fullFormat, settings])

  const limsColumns: any[] = useMemo(() => [
    { title: '仪器名称', dataIndex: 'name', key: 'name', width: 200, align: 'center' },
    { title: '管理编号', dataIndex: 'management_number', key: 'management_number', width: 150, align: 'center' },
    { title: '记录时间', dataIndex: 'timestamp', key: 'timestamp', width: 180, align: 'center', render: (val: string) => dayjs(val).format(fullFormat) },
    { title: '类型', dataIndex: 'record_type', key: 'record_type', width: 100, align: 'center', render: (val: string) => val === 'exhausted' ? '已耗尽' : val },
    { title: '详情', dataIndex: 'details', key: 'details', width: 300, align: 'center', render: (val: string) => {
        try {
            const obj = JSON.parse(val);
            return obj.message || val;
        } catch {
            return val;
        }
    }}
  ], [fullFormat])

  return (
    <>
      <ModuleHeader title="使用与消耗" icon={<LineChartOutlined />} />
      <Card>
        <Space direction="vertical" size={5} style={{ marginBottom: 16, width: '50%' }}>
            <div style={{ display: 'flex', width: '100%', gap: '5px' }}>
                <PermissionGuard permission="stats:usage:search">
                  <div style={{ display: 'flex', flex: 1, gap: '7px' }}>
                    <Input placeholder="搜索仪器名称/型号/管理编号" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ flex: 1, height: '51px' }} />
                    <Button type="primary" onClick={() => {
                        if (activeTab === 'usage') fetchUsage(1)
                        else if (activeTab === 'materialUsage') fetchMaterialUsage(1)
                        else if (activeTab === 'used') fetchUsed(1)
                        else if (activeTab === 'disabled') fetchDisabled(1)
                    }} style={{ height: '51px' }}>查询</Button>
                  </div>
                </PermissionGuard>
                <PermissionGuard permission="stats:usage:export">
                  <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ height: '51px' }}>导出</Button>
                </PermissionGuard>
            </div>

            <PermissionGuard permission="stats:usage:search">
              <Space wrap size={7}>
                <RangePicker showTime value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => { if (v && v[0] && v[1]) setRange([v[0].toISOString(), v[1].endOf('day').toISOString()]) }} style={{ height: '51px' }} />
                {activeTab === 'usage' ? (
                    <Select value={filterType} onChange={setFilterType} options={[{value:'全部',label:'全部类型'},{value:'标准器',label:'标准器'},{value:'辅助设备',label:'辅助设备'}]} style={{ minWidth: 120, height: '51px' }} />
                ) : (
                    <Select value={filterType} onChange={setFilterType} options={[{value:'全部',label:'全部类型'},{value:'标准器',label:'标准器'},{value:'标准物质',label:'标准物质'},{value:'辅助设备',label:'辅助设备'}]} style={{ minWidth: 120, height: '51px' }} />
                )}
                <Select value={filterAction} onChange={setFilterAction} options={[{value:'全部',label:'全部操作'},{value:'out',label:'出库'},{value:'in',label:'入库'}]} style={{ minWidth: 120, height: '51px' }} />
                <Select value={filterDept} onChange={setFilterDept} options={[{value:'理化',label:'理化'},{value:'热工',label:'热工'}]} allowClear placeholder="科室" style={{ minWidth: 100, height: '51px' }} />
                <Input placeholder="操作人" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 100, height: '51px' }} />
              </Space>
            </PermissionGuard>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
            { label: '使用记录', key: 'usage' },
            { label: '标准物质使用记录', key: 'materialUsage' },
            { label: '已使用记录', key: 'used' },
            { label: '停用记录', key: 'disabled' },
            { label: 'LIMS标物记录', key: 'lims' }
        ]} />
        
        {activeTab === 'usage' && (
            <DataTable 
                tableId="usage-consumption-usage"
                rowKey="id" 
                loading={loading}
                dataSource={usageData} 
                columns={usageColumns} 
                pagination={true}
                currentPage={usagePage}
                pageSize={settings.table?.pageSize ?? 20}
                total={usageTotal}
                onPageChange={fetchUsage}
            />
        )}

        {activeTab === 'materialUsage' && (
            <DataTable 
                tableId="usage-consumption-material"
                rowKey="id" 
                loading={loading}
                dataSource={materialData} 
                columns={materialColumns} 
                pagination={true}
                currentPage={materialPage}
                pageSize={settings.table?.pageSize ?? 20}
                total={materialTotal}
                onPageChange={fetchMaterialUsage}
            />
        )}

        {activeTab === 'used' && (
            <DataTable 
                tableId="usage-consumption-used"
                rowKey="id" 
                loading={loading}
                dataSource={usedData} 
                columns={usedColumns} 
                pagination={true}
                currentPage={usedPage}
                pageSize={settings.table?.pageSize ?? 20}
                total={usedTotal}
                onPageChange={fetchUsed}
            />
        )}

        {activeTab === 'disabled' && (
            <DataTable 
                tableId="usage-consumption-disabled"
                rowKey="id" 
                loading={loading}
                dataSource={disabledData} 
                columns={disabledColumns} 
                pagination={true}
                currentPage={disabledPage}
                pageSize={settings.table?.pageSize ?? 20}
                total={disabledTotal}
                onPageChange={fetchDisabled}
            />
        )}

        {activeTab === 'lims' && (
            <DataTable 
                tableId="usage-consumption-lims"
                rowKey="id" 
                loading={loading}
                dataSource={limsData} 
                columns={limsColumns} 
                pagination={true}
                currentPage={limsPage}
                pageSize={settings.table?.pageSize ?? 20}
                total={limsTotal}
                onPageChange={fetchLims}
            />
        )}
      </Card>

      <DetailModal
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        instrument={selectedInstrument}
      />

      <Modal
        title={activeTab === 'disabled' ? '编辑停用记录' : '编辑备注'}
        open={remarkEditVisible}
        onCancel={() => setRemarkEditVisible(false)}
        onOk={handleEditSubmit}
        okText="确定"
        cancelText="取消"
        forceRender
      >
        <Form form={remarkForm} layout="vertical">
          {activeTab === 'disabled' && (
            <>
              <Form.Item name="status" label="仪器状态" rules={[{ required: true }]}>
                <Select options={[
                  { label: '正常', value: '正常' },
                  { label: '停用', value: '停用' },
                  { label: '维修中', value: '维修中' },
                  { label: '已使用', value: '已使用' }
                ]} />
              </Form.Item>
              <Form.Item name="inOutStatus" label="出入库状态" rules={[{ required: true }]}>
                 <Select options={[
                  { label: '入库', value: '入库' },
                  { label: '出库', value: '出库' },
                  { label: '外出使用', value: '外出使用' }
                ]} />
              </Form.Item>
            </>
          )}
          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

const UsageConsumption: React.FC = () => {
  return (
    <PermissionGuard permission="stats:usage:view">
      <UsageConsumptionContent />
    </PermissionGuard>
  )
}

export default UsageConsumption
