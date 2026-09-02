import { useCallback, useEffect, useState } from 'react'
import { getAlerts, generateAlerts } from '../services/alertService'

export default function useAlertData(initialParams?: { level?: string; type?: string; status?: string }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<{ level?: string; type?: string; status?: string }>(initialParams || {})

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAlerts(params)
      setData(Array.isArray(res.data) ? (res.data as any[]) : [])
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [params])

  const regenerate = useCallback(async (threshold: number) => {
    setLoading(true)
    try {
      await generateAlerts(threshold)
    } finally {
      setLoading(false)
    }
    await refresh()
  }, [refresh])

  useEffect(() => { refresh() }, [refresh])

  return { data, loading, error, params, setParams, refresh, regenerate }
}
