import { useEffect, useState } from 'react'
import { Table, Card, Space, DatePicker, Input, Button, App, Popconfirm } from 'antd'
import dayjs from 'dayjs'
import apiClient from '../../../../services/apiClient'
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard'
import { FileTextOutlined } from '@ant-design/icons'
import ModuleHeader from '../../../../components/UI/ModuleHeader'


const { RangePicker } = DatePicker

export default function LogViewer() {
  const { message } = App.useApp()
  const [range, setRange] = useState<[string, string]>([dayjs().subtract(7,'day').toISOString(), dayjs().toISOString()])
  const [module, setModule] = useState<string>('')
  const [action, setAction] = useState<string>('')
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [loading, setLoading] = useState(false)

  const fetchLogs = async (p = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.get('/audits', { params: { start: range[0], end: range[1], module, action, page: p, pageSize: 20 } })
      const data = (res.data || {})
      setRows((data.rows || []).map((r: any) => ({ key: r.id, ...r })))
      setTotal(Number(data.total || 0))
      setPage(p)
    } catch { setRows([]); setTotal(0) }
    setLoading(false)
  }

  useEffect(() => { 
    fetchLogs(1) 
  }, [range[0], range[1], module, action])

  const columns = [
    { title: '操作时间', dataIndex: 'timestamp', align: 'center' },
    { title: '操作人', dataIndex: 'username', align: 'center' },
    { title: '角色', dataIndex: 'role', align: 'center' },
    { title: '模块', dataIndex: 'module', align: 'center' },
    { title: '操作类型', dataIndex: 'action', align: 'center' },
    { title: '目标对象', dataIndex: 'target_id', align: 'center' },
  ]

  const exportCSV = async () => {
    try {
      const blob = await apiClient.download('/audits/export.csv', { params: { start: range[0], end: range[1], module, action } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audit_logs.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  return (
    <PermissionGuard permission="system:audit:view">
    <>
      <ModuleHeader title="操作日志" icon={<FileTextOutlined />} />
      <Card>
        <Space wrap style={{ marginBottom: 12 }}>
          <RangePicker value={[dayjs(range[0]), dayjs(range[1])]} onChange={(v) => v && setRange([v[0]!.toISOString(), v[1]!.toISOString()])} />
          <Input placeholder="模块" value={module} onChange={(e) => setModule(e.target.value)} style={{ width: 160 }} />
          <Input placeholder="动作" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: 160 }} />
          <Button onClick={() => fetchLogs(1)}>查询</Button>
          <PermissionGuard permission="system:audit:export">
            <Button onClick={exportCSV}>导出</Button>
          </PermissionGuard>
          <PermissionGuard permission="system:audit:clean">
            <Popconfirm
              title="确定要清空所有操作日志吗？此操作不可恢复。"
              onConfirm={async () => {
                try {
                  await apiClient.delete('/audits')
                  message.success('日志已清空')
                  fetchLogs(1)
                } catch {
                  message.error('清空日志失败')
                }
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button danger>清空日志</Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
        <Table loading={loading} dataSource={rows} columns={columns as any} rowKey="key" pagination={{ current: page, pageSize: 20, total, onChange: (p) => fetchLogs(p) }} />
      </Card>
    </>
    </PermissionGuard>
  )
}
