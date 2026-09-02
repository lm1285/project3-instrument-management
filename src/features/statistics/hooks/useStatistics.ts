import { getInstrumentDetail, getInstrumentHistory } from '../services/statisticsService'

export function useStatistics() {
  const fetchInstrumentHistory = async (id: string) => {
    const res = await getInstrumentHistory(id)
    return res?.items || []
  }
  const fetchInstrumentDetail = async (id: string) => {
    const res = await getInstrumentDetail(id)
    return res || null
  }
  return { fetchInstrumentHistory, fetchInstrumentDetail }
}
