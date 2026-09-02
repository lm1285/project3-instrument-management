import { useState, useEffect } from 'react';
import { getSystemConfig } from '../services/instrumentFlowService';
import type { Instrument, ModalStates } from '../types';

interface SystemConfig {
  departments: string[];
  operators: string[];
  locations: string[];
  purposes: string[];
}

interface InstrumentFlowState {
  // 搜索和筛选状态
  searchQuery: string;
  flowStatusFilter: string | undefined;
  typeFilter: string | undefined;
  departmentFilter: string | undefined;
  
  // 模态框状态
  modalStates: ModalStates;
  selectedInstrument: Instrument | null;
  
  // 系统配置数据
  systemConfig: SystemConfig;
  
  // 加载状态
  loading: boolean;
  
  // 数据刷新函数
  refreshKey: number;
  
  // 更新状态的函数
  setSearchQuery: (query: string) => void;
  setFlowStatusFilter: (filter: string | undefined) => void;
  setTypeFilter: (filter: string | undefined) => void;
  setDepartmentFilter: (filter: string | undefined) => void;
  setModalStates: React.Dispatch<React.SetStateAction<ModalStates>>;
  setSelectedInstrument: (instrument: Instrument | null) => void;
  setLoading: (loading: boolean) => void;
  setRefreshKey: (key: number) => void;
}

export const useInstrumentFlowState = (): InstrumentFlowState => {
  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [flowStatusFilter, setFlowStatusFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>(undefined);
  
  // 模态框状态
  const [modalStates, setModalStates] = useState<ModalStates>({
    showDetailModal: false,
    showCheckOutModal: false,
    showCheckInModal: false,
    showUseModal: false,
    showClearModal: false,
    showReservationModal: false,
    showBorrowModal: false
  });
  
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  
  // 系统配置数据
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    departments: [],
    operators: [],
    locations: [],
    purposes: []
  });
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  
  // 数据刷新函数
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 加载系统配置
  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const config = await getSystemConfig();
        setSystemConfig(config);
      } catch (error) {
        console.error('Failed to load system config:', error);
        // 使用默认配置
        setSystemConfig({
          departments: ['理化', '热工'],
          operators: ['张三', '李四', '王五', '赵六', '钱七'],
          locations: ['A楼1层', 'A楼2层', 'B楼1层', 'B楼2层', '仓库'],
          purposes: ['常规检测', '研发测试', '质量控制', '校准', '维修']
        });
      }
    };
    
    loadSystemConfig();
  }, []);
  
  return {
    searchQuery,
    flowStatusFilter,
    typeFilter,
    departmentFilter,
    modalStates,
    selectedInstrument,
    systemConfig,
    loading,
    refreshKey,
    setSearchQuery,
    setFlowStatusFilter,
    setTypeFilter,
    setDepartmentFilter,
    setModalStates,
    setSelectedInstrument,
    setLoading,
    setRefreshKey
  };
};