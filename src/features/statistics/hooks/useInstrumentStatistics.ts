import { useState, useEffect, useMemo } from 'react';
import { App } from 'antd';
import apiClient from '../../../services/apiClient';
import dayjs from 'dayjs';
import { parseExcelSerialDate } from '../../../utils/dateUtils';

// 定义仪器类型
export interface Instrument {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  managementNumber: string;
  status: string;
  location: string;
  department: string;
  type: string;
  createdAt?: string;
  calibrationDate?: string;
  nextCalibrationDate?: string;
  inOutStatus?: string;
  purchaseDate?: string;
  enableDate?: string;
}

export const useInstrumentStatistics = () => {
  const { message: messageApi } = App.useApp();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 筛选状态
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  
  // 图表类型控制
  const [deptChartType, setDeptChartType] = useState<'bar' | 'pie'>('bar');
  const [statusChartType, setStatusChartType] = useState<'pie' | 'bar'>('pie');
  
  // 视图保存
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [viewName, setViewName] = useState('');

  // 购置日期维度
  const [purchaseDateDimension, setPurchaseDateDimension] = useState<'year' | 'month'>('year');

  // 刷新数据
  const refreshData = (showMsg = true) => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Instruments (for current state stats & filtering)
        const resp = await apiClient.get('/instruments', { params: { pageSize: 10000 } });
        const instrumentsData = Array.isArray(resp.data) ? (resp.data as Instrument[]) : 
                               (resp.data.data && Array.isArray(resp.data.data) ? resp.data.data : []);
        setInstruments(instrumentsData);
        
        if (showMsg) {
          messageApi.success('数据已更新');
        }
      } catch (error) {
        console.error('加载统计数据失败:', error);
        messageApi.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  };

  // Initial load
  useEffect(() => {
    refreshData(false);
    const timer = setInterval(() => refreshData(false), 60000);
    return () => clearInterval(timer);
  }, []);

  // 过滤后的仪器列表
  const filteredInstruments = useMemo(() => {
    return instruments.filter(ins => {
      if (selectedDept !== 'all' && ins.department !== selectedDept) return false;
      if (selectedType !== 'all' && !ins.type?.includes(selectedType)) return false;
      
      // 状态筛选逻辑
      if (selectedStatus !== 'all') {
        const isExpired = ins.nextCalibrationDate ? dayjs(ins.nextCalibrationDate).isBefore(dayjs()) : false;
        if (selectedStatus === '超期' && !isExpired) return false;
        if (selectedStatus !== '超期' && ins.status !== selectedStatus) return false;
      }
      
      return true;
    });
  }, [instruments, selectedDept, selectedType, selectedStatus]);

  // 统计计算
  const stats = useMemo(() => {
    const totalCount = filteredInstruments.length;
    const today = dayjs();

    // 状态分布
    const statusCounts = {
      inUse: 0,
      expired: 0,
      stopped: 0,
      used: 0,
      other: 0
    };

    // 类型分布
    const typeCounts = {
      standard: 0,
      material: 0,
      auxiliary: 0
    };

    // 科室分布
    const deptCounts: Record<string, number> = {};

    // 在库/出库统计
    const stockCounts = {
      inStock: 0,
      outStock: 0
    };

    // 购置日期统计 (实际上是启用日期)
    const purchaseDateCounts: Record<string, number> = {};

    filteredInstruments.forEach(ins => {
      // 状态统计
      const isExpired = ins.nextCalibrationDate ? dayjs(ins.nextCalibrationDate).isBefore(today) : false;
      if (isExpired) statusCounts.expired++;
      else if (ins.status === '使用中') statusCounts.inUse++;
      else if (ins.status === '停用') statusCounts.stopped++;
      else if (ins.status === '已使用') statusCounts.used++;
      else statusCounts.other++;

      // 类型统计
      if (ins.type?.includes('标准器')) typeCounts.standard++;
      else if (ins.type?.includes('标准物质')) typeCounts.material++;
      else if (ins.type?.includes('辅助设备')) typeCounts.auxiliary++;

      // 科室统计
      const dept = ins.department || '未知';
      deptCounts[dept] = (deptCounts[dept] || 0) + 1;

      // 在库统计
      if (ins.inOutStatus === '已出库' || ins.inOutStatus === '外出使用') stockCounts.outStock++;
      else stockCounts.inStock++;

      // 购置日期统计 (使用 enableDate)
      if (ins.enableDate) {
        let date = dayjs(ins.enableDate);
        
        // Fix: 检测并处理 Excel 序列号日期 (例如 "45044")
        const excelDate = parseExcelSerialDate(ins.enableDate);
        if (excelDate) {
           date = dayjs(excelDate);
        }

        if (date.isValid()) {
          const format = purchaseDateDimension === 'year' ? 'YYYY' : 'YYYY-MM';
          // 过滤掉年份异常的数据 (例如 > 3000 年的数据，防止错误解析)
          if (date.year() < 3000 && date.year() > 1900) {
            const key = date.format(format);
            purchaseDateCounts[key] = (purchaseDateCounts[key] || 0) + 1;
          }
        }
      }
    });

    return {
      totalCount,
      statusCounts,
      typeCounts,
      deptCounts,
      stockCounts,
      purchaseDateCounts
    };
  }, [filteredInstruments, purchaseDateDimension]);

  // 图表数据准备
  const chartData = useMemo(() => {
    // 状态分布图表数据
    const statusData = [
      { name: '使用中', value: stats.statusCounts.inUse },
      { name: '超期', value: stats.statusCounts.expired },
      { name: '停用', value: stats.statusCounts.stopped },
      { name: '已使用', value: stats.statusCounts.used },
    ].filter(d => d.value > 0);

    // 类型分布图表数据
    const typeData = [
      { name: '标准器', value: stats.typeCounts.standard },
      { name: '标准物质', value: stats.typeCounts.material },
      { name: '辅助设备', value: stats.typeCounts.auxiliary },
    ].filter(d => d.value > 0);

    // 科室分布图表数据
    const deptData = Object.keys(stats.deptCounts).map(dept => ({
      name: dept,
      value: stats.deptCounts[dept]
    })).sort((a, b) => b.value - a.value);

    // 购置趋势图表数据
    const purchaseTrendData = Object.keys(stats.purchaseDateCounts).map(date => ({
      name: date,
      value: stats.purchaseDateCounts[date]
    })).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusData,
      typeData,
      deptData,
      purchaseTrendData
    };
  }, [stats]);

  // 获取所有科室列表
  const departments = useMemo(() => {
    const depts = new Set<string>();
    instruments.forEach(ins => {
      if (ins.department) depts.add(ins.department);
    });
    return Array.from(depts);
  }, [instruments]);

  return {
    loading,
    selectedDept,
    setSelectedDept,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    deptChartType,
    setDeptChartType,
    statusChartType,
    setStatusChartType,
    purchaseDateDimension,
    setPurchaseDateDimension,
    isSaveModalVisible,
    setIsSaveModalVisible,
    viewName,
    setViewName,
    stats,
    chartData,
    departments,
    handleSaveView: () => {
        // Implement save view logic or remove if not needed
        setIsSaveModalVisible(true);
    },
    refreshData
  };
};
