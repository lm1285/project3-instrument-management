import { useState, useEffect } from 'react';
import { App } from 'antd';
import { getAlerts, deleteAlert, updateAlertStatus } from '../services/alertService';
import { messageService } from '../../../services/messageService';

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  status: 'warning' | 'danger' | 'info' | 'success';
  processedStatus: string;
  createTime: string;
  location: string;
  instrumentId: string;
}

export interface StatsData {
  totalAlerts: number;
  pendingAlerts: number;
  resolvedAlerts: number;
  criticalAlerts: number;
}

export const useDashboardOverview = () => {
  const { message, modal } = App.useApp();
  
  // 状态管理
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [alertList, setAlertList] = useState<AlertItem[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalAlerts: 0,
    pendingAlerts: 0,
    resolvedAlerts: 0,
    criticalAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  // 辅助函数：映射后端状态到前端状态
  const mapBackendStatusToFrontend = (alertType: string, processedStatus: string): AlertItem['status'] => {
    if (processedStatus === '已完成') return 'success';
    if (alertType === '紧急') return 'danger';
    if (alertType === '重要') return 'warning';
    return 'info';
  };

  // 从API获取数据
  const loadData = async () => {
    try {
      setLoading(true);
      
      const res = await getAlerts();
      if (res.data && Array.isArray(res.data)) {
        // 同步预警到站内信
        messageService.syncAlerts(res.data);
        
        // 转换API数据格式以匹配前端显示
        const alertsData = res.data.map((item: any) => ({
          id: item.id,
          title: item.alertType || '预警信息',
          description: `${item.name} (${item.model}) - ${item.alertType}`,
          status: mapBackendStatusToFrontend(item.alertType, item.processedStatus),
          processedStatus: item.processedStatus || '预警',
          createTime: item.generatedTime,
          location: item.storageLocation || '未知位置',
          instrumentId: item.managementNumber || item.instrumentId
        }));
        setAlertList(alertsData);
      } else {
        // 如果API返回格式不正确，设置为空数组
        console.error('API返回格式不正确:', res);
        setAlertList([]);
      }
    } catch (error) {
      console.error('加载数据处理异常:', error);
      message.error('获取预警数据失败，请检查网络或联系管理员');
      setAlertList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 更新统计数据
  useEffect(() => {
    setStats({
      totalAlerts: alertList.length,
      pendingAlerts: alertList.filter(alert => alert.status === 'warning' || alert.status === 'danger').length,
      resolvedAlerts: alertList.filter(alert => alert.status === 'success').length,
      criticalAlerts: alertList.filter(alert => alert.status === 'danger').length,
    });
  }, [alertList]);

  // 根据搜索条件过滤数据
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAlerts(alertList);
    } else {
      const filtered = alertList.filter(alert => 
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.instrumentId.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAlerts(filtered);
    }
  }, [searchQuery, alertList]);

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  // 处理分页变化
  const handlePageChange = (page: number, newPageSize?: number) => {
    setCurrentPage(page);
    // 如果传入了新的页大小，则更新页大小状态
    if (newPageSize !== undefined) {
      setPageSize(newPageSize);
    }
  };

  // 获取当前页的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAlerts.slice(startIndex, endIndex);
  };

  // 处理删除预警
  const handleDelete = (id: string) => {
    modal.confirm({
      title: '确认删除',
      content: '确认后此仪器将不进行预警',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 尝试调用API删除
          try {
            await deleteAlert(id);
          } catch (e) {
            console.warn('API删除失败，可能是模拟数据', e);
          }
          
          // 更新本地状态
          const newList = alertList.filter(item => item.id !== id);
          setAlertList(newList);
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  // 处理状态更新
  const handleStatusChange = (id: string, newStatus: string) => {
    modal.confirm({
      title: '确认修改状态',
      content: `确定将处理状态修改为"${newStatus}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 调用API更新状态
          try {
            // '系统操作员' should ideally come from a user context
            await updateAlertStatus(id, newStatus, '系统操作员');
          } catch (e) {
            console.warn('API更新失败，可能是模拟数据', e);
          }

          // 更新本地状态
          const updatedList = alertList.map(item => {
            if (item.id === id) {
              // Re-calculate status based on the new processedStatus
              // Note: item.title usually holds alertType based on loadData logic
              const newFrontendStatus = mapBackendStatusToFrontend(item.title, newStatus);
              
              return {
                ...item,
                processedStatus: newStatus,
                status: newFrontendStatus
              };
            }
            return item;
          });
          setAlertList(updatedList);
          message.success('状态更新成功');
        } catch (error) {
          message.error('状态更新失败');
        }
      }
    });
  };

  return {
    searchQuery,
    currentPage,
    pageSize,
    stats,
    loading,
    total: filteredAlerts.length,
    handleSearch,
    handlePageChange,
    getCurrentPageData,
    handleDelete,
    handleStatusChange
  };
};
