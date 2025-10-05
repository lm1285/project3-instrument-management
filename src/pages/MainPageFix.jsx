import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import pinyin from 'pinyin';
import * as XLSX from 'xlsx';
import '../styles/MainPage.css';
import '../styles/FormStyles.css';
import Alert from '../components/common/Alert.jsx';
import DelayModal from '../components/DelayModal';
import DataStorage from '../utils/DataStorage';

function MainPageFix() {
  const navigate = useNavigate()
  const [activeMenuItem, setActiveMenuItem] = useState('instrument-management')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)
  const [expandedSubmenu, setExpandedSubmenu] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchQueryInOut, setSearchQueryInOut] = useState('')  // 独立的仪器出入界面搜索状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingInstrumentId, setEditingInstrumentId] = useState(null)
  const [instruments, setInstruments] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // 为仪器出入界面创建独立的建议状态
  const [suggestionsInOut, setSuggestionsInOut] = useState([])
  const [showSuggestionsInOut, setShowSuggestionsInOut] = useState(false)
  const [selectedInstruments, setSelectedInstruments] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  // 详情模态框状态
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  // 列调整状态
  const [columnOrder, setColumnOrder] = useState([
    'checkbox', 'name', 'model', 'managementNumber', 'factoryNumber', 'manufacturer', 
    'type', 'measurementRange', 'measurementUncertainty', 'calibrationStatus', 'calibrationDate', 
    'recalibrationDate', 'period', 'traceabilityAgency', 'traceabilityCertificate', 'storageLocation', 
    'department', 'instrumentStatus', 'inOutStatus', 'remarks', 'attachments', 'action'
  ])
  const [columnWidths, setColumnWidths] = useState({})
  const [draggedColumn, setDraggedColumn] = useState(null)
  // 筛选表单状态
  const [filterForm, setFilterForm] = useState({
    department: '',
    type: '',
    instrumentStatus: '',
    inOutStatus: '',
    startDate: '',
    endDate: ''
  })
  const [filteredInstruments, setFilteredInstruments] = useState([])
  // 当前用户
  const currentUser = "当前用户" // 实际项目中应该从登录状态获取
  
  // 提示消息状态
  const [alertMessage, setAlertMessage] = useState(null)

  // 24时自动刷新机制
  useEffect(() => {
    // 检查并清除过期的当天操作记录
    const checkAndRefreshDailyRecords = () => {
      const allInstruments = instrumentStorage.getAll();
      const today = new Date().toDateString();
      const updatedInstruments = allInstruments.map(instrument => {
        // 检查是否为当天操作记录且未经过延期
        if (instrument.operationDate === today && !instrument.deletedTodayRecord && !instrument.displayUntil) {
          // 标记为已删除当天记录，使其在24时后不再显示
          return { ...instrument, deletedTodayRecord: true };
        }
        return instrument;
      });
      
      // 如果有更新，保存回存储
      if (updatedInstruments.some((newInst, index) => newInst !== allInstruments[index])) {
        instrumentStorage.saveAll(updatedInstruments);
        fetchInstruments();
      }
    };

    // 立即检查一次
    checkAndRefreshDailyRecords();

    // 设置定时器，每分钟检查一次
    const intervalId = setInterval(checkAndRefreshDailyRecords, 60000);

    // 清除定时器
    return () => clearInterval(intervalId);
  }, [])

  // 文本格式处理函数 - 现在直接使用HTML标签，不再进行符号转换
  const formatText = (text) => {
    if (!text || typeof text !== 'string') return text || '-';
    
    // 直接返回原始文本，因为现在用户会直接输入HTML标签
    return text;
  };

  // 仪器表单状态
  const [instrumentForm, setInstrumentForm] = useState({
    name: '',
    model: '',
    managementNumber: '',
    storageLocation: '',
    instrumentStatus: '',
    type: '',
    calibrationStatus: '',
    department: ''
  })
  
  // 获取当前时间，精确到秒
  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
  };

  // 处理出库操作
  const handleOutbound = (managementNumber) => {
    // 输入验证
    if (!managementNumber || typeof managementNumber !== 'string') {
      console.error('出库操作失败：无效的管理编号');
      return;
    }
    
    // 获取当前所有仪器数据
    const allInstruments = instrumentStorage.getAll()
    
    // 查找要更新的仪器
    const instrument = allInstruments.find(item => item.managementNumber === managementNumber)
    
    if (instrument) {
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 准备更新的数据
      const updatedInstrument = {
        ...instrument,
        id,
        inOutStatus: 'out',
        operator: currentUser,
        outboundTime: getCurrentDateTime(),
        inboundTime: '-', // 清空入库时间
        operationDate: new Date().toDateString() // 用于24时刷新机制
      }
      
      // 更新存储并处理结果
      const updateResult = instrumentStorage.update(id, updatedInstrument)
      
      if (updateResult) {
        // 刷新数据显示
        fetchInstruments()
        
        // 显示成功提示
        setAlertMessage({ message: `仪器 ${instrument.name} (${managementNumber}) 已成功出库`, type: 'success' })
      } else {
        console.error('更新存储失败');
        setAlertMessage({ message: `出库操作失败，请重试`, type: 'error' })
      }
    } else {
      console.error('未找到指定的仪器');
      setAlertMessage({ message: `未找到管理编号为 ${managementNumber} 的仪器`, type: 'error' })
    }
  }
  
  // 处理入库操作
  const handleInbound = (managementNumber) => {
    // 输入验证
    if (!managementNumber || typeof managementNumber !== 'string') {
      console.error('入库操作失败：无效的管理编号');
      return;
    }
    
    // 获取当前所有仪器数据
    const allInstruments = instrumentStorage.getAll()
    
    // 查找要更新的仪器
    const instrument = allInstruments.find(item => item.managementNumber === managementNumber)
    
    if (instrument) {
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 准备更新的数据
      const updatedInstrument = {
        ...instrument,
        id,
        inOutStatus: 'in',
        operator: currentUser,
        inboundTime: getCurrentDateTime(),
        operationDate: new Date().toDateString() // 用于24时刷新机制
      }
      
      // 更新存储并处理结果
      const updateResult = instrumentStorage.update(id, updatedInstrument)
      
      if (updateResult) {
        // 刷新数据显示
        fetchInstruments()
        
        // 显示成功提示
        setAlertMessage({ message: `仪器 ${instrument.name} (${managementNumber}) 已成功入库`, type: 'success' })
      } else {
        console.error('更新存储失败');
        setAlertMessage({ message: `入库操作失败，请重试`, type: 'error' })
      }
    } else {
      console.error('未找到指定的仪器');
      setAlertMessage({ message: `未找到管理编号为 ${managementNumber} 的仪器`, type: 'error' })
    }
  }
  
  // 处理使用操作
  const handleUseInstrument = (managementNumber) => {
    // 获取当前所有仪器数据
    const allInstruments = instrumentStorage.getAll()
    
    // 查找要更新的仪器
    const instrument = allInstruments.find(item => item.managementNumber === managementNumber)
    
    if (instrument) {
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 准备更新的数据
      const updatedInstrument = {
        ...instrument,
        id,
        instrumentStatus: 'used',
        operator: currentUser,
        usedTime: getCurrentDateTime(),
        operationDate: new Date().toDateString() // 用于24时刷新机制
      }
      
      // 更新存储
      instrumentStorage.update(id, updatedInstrument)
      
      // 刷新数据显示
      fetchInstruments()
      
      // 显示成功提示
      alert(`仪器 ${instrument.name} (${managementNumber}) 已标记为已使用`)
    }
  }
  

  
  // 延期操作的状态 - 简化版本，使用独立组件
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedManagementNumber, setSelectedManagementNumber] = useState('');

  // 打开延期模态框 - 使用独立组件
  const handleDelayInstrument = (managementNumber) => {
    console.log('handleDelayInstrument called with:', managementNumber);
    
    // 立即显示模态框，所有逻辑移至独立组件
    setSelectedManagementNumber(managementNumber || 'TEMP-' + Date.now());
    setShowDelayModal(true);
    console.log('showDelayModal set to:', true);
    
    // 异步进行数据检查（保留原有数据准备逻辑）
    setTimeout(() => {
      // 确保有可延期的仪器数据
      const allInstruments = instrumentStorage.getAll();
      
      // 如果没有任何仪器数据，创建一些测试数据
      if (allInstruments.length === 0) {
        console.log('没有找到任何仪器数据，创建测试数据');
        const testData = [
          {
            id: 'test-' + Date.now(),
            name: '测试仪器1-可延期',
            model: 'Test Model 1',
            managementNumber: 'TEST-001',
            inOutStatus: 'out',
            operationDate: new Date().toDateString(),
            outboundTime: getCurrentDateTime()
          },
          {
            id: 'test-' + (Date.now() + 1),
            name: '测试仪器2-可入库',
            model: 'Test Model 2',
            managementNumber: 'TEST-002',
            inOutStatus: 'in',
            operationDate: new Date().toDateString(),
            inboundTime: getCurrentDateTime()
          }
        ];
        
        instrumentStorage.saveAll(testData);
        fetchInstruments();
        setAlertMessage({ message: '已创建测试数据，请刷新页面后重试', type: 'info' });
      } else if (!allInstruments.find(instrument => instrument.inOutStatus === 'out')) {
        // 如果有数据但没有出库状态的仪器，将第一个仪器标记为出库
        const firstInstrument = { ...allInstruments[0] };
        firstInstrument.inOutStatus = 'out';
        firstInstrument.operationDate = new Date().toDateString();
        firstInstrument.outboundTime = getCurrentDateTime();
        
        instrumentStorage.update(firstInstrument.id, firstInstrument);
        fetchInstruments();
        setAlertMessage({ message: '已将第一个仪器设置为出库状态，请刷新页面后重试', type: 'info' });
      }
    }, 500);
  };

  // 处理延期确认 - 配合独立组件使用的版本
  const handleDelayConfirm = (delayDays) => {
    console.log('handleDelayConfirm called with:', { delayDays, selectedManagementNumber });
    
    // 输入验证（由独立组件处理，这里再做一次保险验证）
    if (isNaN(delayDays) || delayDays <= 0) {
      setAlertMessage({ message: '请输入有效的延期天数（必须是大于0的整数）', type: 'error' });
      return;
    }
    
    try {
      // 获取当前所有仪器数据
      const allInstruments = instrumentStorage.getAll();
      console.log('Found instruments:', allInstruments.length);
      
      // 查找要延期的仪器
      const instrumentIndex = allInstruments.findIndex(item => item.managementNumber === selectedManagementNumber);
      const instrument = allInstruments[instrumentIndex];
      console.log('Found instrument:', instrument, 'at index:', instrumentIndex);
      
      if (!instrument || instrumentIndex === -1) {
        throw new Error('未找到指定的仪器');
      }
      
      // 计算新的应归还日期
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + delayDays);
      
      // 准备更新的数据
      const updatedInstrument = {
        ...instrument,
        // 确保有ID
        id: instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        delayDays,
        expectedReturnDate: currentDate.toLocaleDateString('zh-CN'),
        delayOperator: currentUser,
        delayTime: getCurrentDateTime(),
        // 添加延期后显示到延期日24时的标记
        displayUntil: currentDate.toLocaleDateString('zh-CN')
      };
      
      // 更新存储 - 使用原始索引位置的ID或新生成的ID
      const updateResult = instrumentStorage.update(updatedInstrument.id, updatedInstrument);
      
      if (updateResult) {
        // 刷新数据显示
        fetchInstruments();
        
        // 显示成功提示
        setAlertMessage({
          message: `仪器 ${instrument.name} (${selectedManagementNumber}) 已成功延期 ${delayDays} 天！该仪器将显示到 ${currentDate.toLocaleDateString('zh-CN')} 24时`,
          type: 'success'
        });
        
        // 关闭模态框
        setShowDelayModal(false);
      } else {
        // 如果更新失败，尝试添加新数据
        console.warn('更新失败，尝试添加新数据');
        const addResult = instrumentStorage.add(updatedInstrument);
        if (addResult || true) { // 注意：add方法没有返回值，所以我们假设它成功
          fetchInstruments();
          setAlertMessage({
            message: `仪器 ${instrument.name} (${selectedManagementNumber}) 已成功延期 ${delayDays} 天！该仪器将显示到 ${currentDate.toLocaleDateString('zh-CN')} 24时`,
            type: 'success'
          });
          setShowDelayModal(false);
        } else {
          throw new Error('更新存储失败，添加新数据也失败');
        }
      }
    } catch (error) {
      console.error('延期操作失败:', error);
      setAlertMessage({ message: `延期操作失败：${error.message}`, type: 'error' });
    }
  };

  // 处理延期取消 - 配合独立组件使用
  const handleDelayCancel = () => {
    setShowDelayModal(false);
  };
  
  // 删除确认对话框状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [managementNumberToDelete, setManagementNumberToDelete] = useState('');

  // 打开删除确认对话框
  const openDeleteConfirm = (managementNumber) => {
    console.log('openDeleteConfirm called with:', managementNumber);
    setManagementNumberToDelete(managementNumber);
    setShowDeleteConfirm(true);
    console.log('showDeleteConfirm set to:', true);
  };

  // 确认删除操作
  const confirmDelete = () => {
    console.log('confirmDelete called with:', managementNumberToDelete);
    // 获取当前所有仪器数据
    const allInstruments = instrumentStorage.getAll()
    
    // 查找要删除的仪器
    const instrument = allInstruments.find(item => item.managementNumber === managementNumberToDelete)
    console.log('Found instrument to delete:', instrument);
    
    if (instrument) {
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 准备更新的数据 - 标记为已删除当天记录
      const updatedInstrument = {
        ...instrument,
        id,
        deletedTodayRecord: true,
        deletedTime: getCurrentDateTime()
      }
      
      // 更新存储
      instrumentStorage.update(id, updatedInstrument)
      
      // 刷新数据显示
      fetchInstruments()
      
      // 显示成功提示
      alert(`仪器 ${instrument.name} (${managementNumberToDelete}) 的当天操作记录已删除！`)
    }
    
    // 关闭确认对话框
    setShowDeleteConfirm(false);
    setManagementNumberToDelete('');
  };

  // 取消删除操作
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setManagementNumberToDelete('');
  };

  // 处理删除当天记录操作
  const handleDeleteTodayRecord = (managementNumber) => {
    openDeleteConfirm(managementNumber);
  };
  

  
  // 显示仪器详情
  const showInstrumentDetails = (instrument) => {
    setSelectedInstrument(instrument)
    setShowDetailModal(true)
  }

  // 创建数据存储实例
  const instrumentStorage = new DataStorage('standard-instruments')

  // 获取仪器列表数据
  const fetchInstruments = () => {
    console.log('fetchInstruments called');
    // 首先从存储中获取真实数据
    const realInstruments = instrumentStorage.getAll()
    console.log('从存储中获取的真实数据数量:', realInstruments.length)
    
    // 如果存储中有数据，使用真实数据
    if (realInstruments.length > 0) {
      setInstruments(realInstruments)
      console.log('已加载真实数据到界面')
      
      // 调试：显示所有仪器的管理编号和状态
      console.log('Loaded instruments:');
      realInstruments.forEach(instrument => {
        console.log(`- ${instrument.managementNumber || '未知编号'}: ${instrument.inOutStatus || '未知状态'}`);
      });
    } else {
      // 只在首次加载且localStorage为空时使用模拟数据
      // 检查localStorage中是否真的没有数据，而不是因为getAll解析失败
      const rawData = localStorage.getItem('standard-instruments');
      if (!rawData) {
        // 如果存储中真的没有数据，使用模拟数据作为初始数据
        const mockInstruments = [
          {
            id: 'instrument-1',
            name: '精密电子天平',
            model: 'ME204',
            managementNumber: 'BM-2023-001',
            factoryNumber: '2023001',
            manufacturer: '梅特勒-托利多',
            type: 'standard',
            measurementRange: '0-220g',
            measurementUncertainty: '±0.1mg',
            calibrationStatus: 'calibration',
            calibrationDate: '2023-06-15',
            recalibrationDate: '2024-06-15',
            period: '12个月',
            traceabilityAgency: '中国计量科学研究院',
            traceabilityCertificate: 'JJF-2023-001',
            storageLocation: '校准实验室1-01',
            department: 'thermal',
            instrumentStatus: 'used',
            inOutStatus: 'in',
            remarks: '日常使用频繁，需加强维护',
            attachments: '校准证书.pdf',
            createdAt: new Date('2023-01-15').toISOString()
          },
          {
            id: 'instrument-2',
            name: '数字万用表',
            model: 'Fluke 87V',
            managementNumber: 'BM-2023-002',
            factoryNumber: '2023002',
            manufacturer: '福禄克',
            type: 'standard',
            measurementRange: '多种量程',
            measurementUncertainty: '0.05%',
            calibrationStatus: 'verification',
            calibrationDate: '2023-05-20',
            recalibrationDate: '2024-05-20',
            period: '12个月',
            traceabilityAgency: '华东计量测试中心',
            traceabilityCertificate: 'JJF-2023-002',
            storageLocation: '电子实验室2-03',
            department: 'physical',
            instrumentStatus: 'in-use',
            inOutStatus: 'in',
            remarks: '',
            attachments: '',
            createdAt: new Date('2023-01-14').toISOString()
          },
          {
            id: 'instrument-3',
            name: '恒温恒湿箱',
            model: 'Binder MK53',
            managementNumber: 'BM-2023-003',
            factoryNumber: '2023003',
            manufacturer: '宾德',
            type: 'auxiliary',
            measurementRange: '0-100°C, 10-98%RH',
            measurementUncertainty: '±0.5°C, ±3%RH',
            calibrationStatus: 'calibration',
            calibrationDate: '2023-04-10',
            recalibrationDate: '2024-04-10',
            period: '12个月',
            traceabilityAgency: '上海计量测试技术研究院',
            traceabilityCertificate: 'JJF-2023-003',
            storageLocation: '环境实验室3-02',
            department: 'thermal',
            instrumentStatus: 'available',
            inOutStatus: 'in',
            remarks: '定期维护，保持清洁',
            attachments: '使用说明书.pdf',
            createdAt: new Date('2023-01-13').toISOString()
          },
          {
            id: 'instrument-4',
            name: '高压灭菌器',
            model: 'SANYO MLS-3780',
            managementNumber: 'BM-2023-004',
            factoryNumber: '2023004',
            manufacturer: '三洋',
            type: 'auxiliary',
            measurementRange: '105-135°C',
            measurementUncertainty: '±1°C',
            calibrationStatus: 'verification',
            calibrationDate: '2023-03-15',
            recalibrationDate: '2024-03-15',
            period: '12个月',
            traceabilityAgency: '华南计量测试中心',
            traceabilityCertificate: 'JJF-2023-004',
            storageLocation: '微生物实验室4-01',
            department: 'physical',
            instrumentStatus: 'maintenance',
            inOutStatus: 'in',
            remarks: '需要更换密封条',
            attachments: '维护记录.xlsx',
            createdAt: new Date('2023-01-12').toISOString()
          },
          {
            id: 'instrument-5',
            name: '分光光度计',
            model: 'Shimadzu UV-1800',
            managementNumber: 'BM-2023-005',
            factoryNumber: '2023005',
            manufacturer: '岛津',
            type: 'standard',
            measurementRange: '190-1100nm',
            measurementUncertainty: '±0.3nm',
            calibrationStatus: 'calibration',
            calibrationDate: '2023-07-01',
            recalibrationDate: '2024-07-01',
            period: '12个月',
            traceabilityAgency: '中国计量科学研究院',
            traceabilityCertificate: 'JJF-2023-005',
            storageLocation: '分析实验室5-03',
            department: 'physical',
            instrumentStatus: 'in-use',
            inOutStatus: 'out',
            remarks: '使用中，注意定期校准',
            attachments: '操作手册.pdf',
            createdAt: new Date('2023-01-11').toISOString()
          }
        ]
        
        setInstruments(mockInstruments)
        // 使用saveAll方法一次性保存所有模拟数据，这样可以确保所有数据都被正确存储
        const saveResult = instrumentStorage.saveAll(mockInstruments)
        console.log('已加载并保存模拟数据到存储:', saveResult)
      } else {
        // 如果localStorage中有数据但解析失败，只设置空数组到界面，不覆盖存储
        setInstruments([])
        console.log('存储中有数据但解析失败，界面显示为空列表')
      }
    }
    
    setSelectedInstruments([])
    setSelectAll(false)
  }

  const handleLogout = () => {
    navigate('/')
  }

  const menuItems = [
    { id: 'dashboard', label: '信息看板', icon: '📊' },
    { id: 'instrument-inout', label: '仪器出入', icon: '🚪' },
    { id: 'instrument-management', label: '仪器管理', icon: '⚖️' },
    {
      id: 'user-settings',
      label: '用户设置',
      icon: '⚙️',
      submenu: [
        { id: 'user-management', label: '用户管理', icon: '👥' },
        { id: 'system-settings', label: '系统设置', icon: '⚙️' }
      ]
    }
  ]

  // 处理表单输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setInstrumentForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 打开添加仪器模态框
  const openAddModal = () => {
    setShowAddModal(true)
    setEditingInstrumentId(null) // 确保是添加模式
    // 重置表单
    setInstrumentForm({
      name: '',
      model: '' ,
      managementNumber: '',
      factoryNumber: '',
      manufacturer: '',
      type: '',
      measurementRange: '',
      measurementUncertainty: '',
      calibrationStatus: '',
      calibrationDate: '',
      recalibrationDate: '',
      period: '',
      traceabilityAgency: '',
      traceabilityCertificate: '',
      storageLocation: '',
      department: '',
      instrumentStatus: '',
      inOutStatus: '',
      remarks: '',
      attachments: ''
    })
  }

  // 测试存储功能
  const testStorage = () => {
    const allInstruments = instrumentStorage.getAll()
    console.log('存储中的所有仪器:', allInstruments)
    console.log('仪器列表长度:', allInstruments.length)
    alert(`存储中共有 ${allInstruments.length} 个仪器。\n\n请查看控制台以获取详细信息。`)
  }

  // 快速添加测试仪器
  const addTestInstrument = () => {
    const testInstrument = {
      name: '测试仪器' + new Date().getTime(),
      model: 'Test-Model',
      managementNumber: 'TEST-' + Math.floor(Math.random() * 10000),
      factoryNumber: 'FAC-' + Math.floor(Math.random() * 10000),
      manufacturer: '测试厂商',
      type: 'standard',
      measurementRange: '0-100',
      measurementUncertainty: '±0.1',
      period: '12个月',
      calibrationDate: new Date().toISOString().split('T')[0],
      recalibrationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      calibrationStatus: 'calibration',
      storageLocation: '测试位置',
      department: 'physical',
      instrumentStatus: 'unused',
      inOutStatus: 'in',
      remarks: '这是一个测试仪器，用于调试更新功能',
      attachments: ''
    }
    console.log('添加测试仪器前存储中的仪器数量:', instrumentStorage.getAll().length)
    const result = instrumentStorage.add(testInstrument)
    console.log('添加测试仪器结果:', result)
    console.log('添加测试仪器后存储中的仪器数量:', instrumentStorage.getAll().length)
    if (result) {
      fetchInstruments()
      alert('测试仪器添加成功！\n\nID: ' + result.id + '\n\n请尝试编辑这个仪器进行测试。')
    } else {
      alert('测试仪器添加失败！')
    }
  }

  // 测试更新功能
  const testUpdate = (id) => {
    const instruments = instrumentStorage.getAll()
    const instrumentToUpdate = instruments.find(inst => inst.id === id)
    if (instrumentToUpdate) {
      const updatedInstrument = { ...instrumentToUpdate, name: '已更新的' + instrumentToUpdate.name }
      console.log('准备更新的仪器:', updatedInstrument)
      const result = instrumentStorage.update(id, updatedInstrument)
      console.log('更新结果:', result)
      alert('更新测试' + (result ? '成功' : '失败') + '！\n\n请查看控制台获取详细信息。')
      fetchInstruments()
    } else {
      alert('未找到要更新的仪器！')
    }
  }

  // 关闭添加仪器表单
  const closeAddModal = () => {
    setShowAddModal(false)
    setEditingInstrumentId(null) // 清除编辑状态
  }

  // 提交添加/编辑仪器表单
  const handleSubmit = (e) => {
    e.preventDefault();
    let result;
    
    console.log('处理表单提交:', { editingInstrumentId, instrumentForm });
    
    if (editingInstrumentId) {
      // 编辑模式
      console.log('执行编辑模式，ID:', editingInstrumentId);
      
      // 1. 检查要更新的仪器是否存在
      const allInstruments = instrumentStorage.getAll();
      const targetInstrument = allInstruments.find(inst => inst.id === editingInstrumentId);
      console.log('目标仪器是否存在:', !!targetInstrument);
      if (targetInstrument) {
        console.log('目标仪器详情:', targetInstrument);
      }
      
      // 2. 执行更新
      console.log('准备更新的表单数据:', instrumentForm);
      result = instrumentStorage.update(editingInstrumentId, instrumentForm);
      console.log('更新结果:', result);
      
      // 3. 检查更新后的结果
      if (result) {
        setShowAddModal(false);
        setEditingInstrumentId(null);
        fetchInstruments(); // 重新获取列表数据
        // 显示成功提示
        alert('仪器更新成功！');
      } else {
        console.log('更新失败，详细分析：');
        console.log('- 编辑ID:', editingInstrumentId);
        console.log('- 当前存储中的仪器数量:', allInstruments.length);
        console.log('- 表单数据:', JSON.stringify(instrumentForm, null, 2));
        alert('更新失败，请重试\n\n查看控制台获取详细调试信息');
      }
    } else {
      // 添加模式
      result = instrumentStorage.add(instrumentForm);
      if (result) {
        setShowAddModal(false);
        fetchInstruments(); // 重新获取列表数据
        // 显示成功提示
        alert('仪器添加成功！');
      } else {
        alert('添加失败，请重试');
      }
    }
  }

  // 处理单个仪器选择
  const handleInstrumentSelect = (id) => {
    setSelectedInstruments(prev => 
      prev.includes(id) 
        ? prev.filter(instrumentId => instrumentId !== id) 
        : [...prev, id]
    )
  }

  // 处理全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedInstruments([])
    } else {
      setSelectedInstruments(instruments.map(instrument => instrument.id))
    }
    setSelectAll(!selectAll)
  }

  // 处理单个仪器删除
  const handleDeleteInstrument = (id) => {
    if (window.confirm('确定要删除该仪器吗？')) {
      setInstruments(prev => prev.filter(instrument => instrument.id !== id));
      // 如果使用真实存储
      instrumentStorage.remove(id);
      fetchInstruments();
    }
  }

  // 处理批量删除
  const handleBatchDelete = () => {
    if (selectedInstruments.length === 0) {
      alert('请先选择要删除的仪器')
      return
    }
    
    if (window.confirm(`确定要删除选中的 ${selectedInstruments.length} 个仪器吗？`)) {
      selectedInstruments.forEach(id => instrumentStorage.remove(id))
      fetchInstruments()
    }
  }

  // 处理导入按钮点击
  const handleImportClick = () => {
    // 触发隐藏的文件输入框
    document.getElementById('excel-import-input').click();
  }

  // 处理Excel文件选择
  const handleExcelFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 检查文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请选择Excel文件(.xlsx或.xls格式)');
      return;
    }

    const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // 读取Excel文件
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // 获取第一个工作表
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          
          // 将工作表数据转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          if (jsonData.length === 0) {
            alert('Excel文件中没有数据');
            return;
          }
          
          // 验证数据并导入
          importInstrumentsFromExcel(jsonData);
        
      } catch (error) {
        console.error('Excel文件解析失败:', error);
        alert('Excel文件解析失败，请检查文件格式');
      }
    };
    reader.onerror = () => {
      alert('文件读取失败');
    };
    reader.readAsArrayBuffer(file);
    
    // 清除文件选择，以便可以重复选择同一个文件
    e.target.value = '';
  }

  // 从Excel数据导入仪器
  const importInstrumentsFromExcel = (data) => {
    // 定义必填字段
    const requiredFields = ['名称', '型号', '管理编号', '出厂编号', '生产厂家'];
    // 支持更多可能的列标题变体
    const fieldMapping = {
      '名称': 'name',
      '型号': 'model',
      '管理编号': 'managementNumber',
      '出厂编号': 'factoryNumber',
      '生产厂家': 'manufacturer',
      '类型': 'type',
      '测量范围': 'measurementRange',
      '测量不确定度': 'measurementUncertainty',
      '检定/校准': 'calibrationStatus',
      '校准日期': 'calibrationDate',
      '复校日期': 'recalibrationDate',
      '周期': 'period',
      '溯源机构': 'traceabilityAgency',
      '溯源证书': 'traceabilityCertificate',
      '存放位置': 'storageLocation',
      '部门': 'department',
      '科室': 'department', // 增加科室作为department的别名
      '仪器状态': 'instrumentStatus',
      '出入库状态': 'inOutStatus',
      '备注': 'remarks',
      '附件': 'attachments'
    };
    
    // 下拉选择框值映射
    const selectValueMapping = {
      'type': {
        '标准器': 'standard',
        '标准物质': 'reference-material',
        '辅助设备': 'auxiliary'
      },
      'instrumentStatus': {
        '使用中': 'in-use',
        '超期使用': 'overdue',
        '停用': 'stopped',
        '已使用': 'used'
      },
      'inOutStatus': {
        '已入库': 'in',
        '已出库': 'out'
      },
      'department': {
        '热工': 'thermal',
        '理化': 'physical',
        '热工thermal': 'thermal', // 增加常见的组合形式
        '理化physical': 'physical' // 增加常见的组合形式
      },
      'calibrationStatus': {
        '检定': 'verification',
        '校准': 'calibration',
        '已校准': 'calibrated',
        '待校准': 'to-calibrate',
        '未校准': 'uncalibrated'
      }
    };

    let importedCount = 0;
    let failedCount = 0;
    const failedRows = [];

    // 验证并处理每一行数据
    for (let i = 0; i < data.length; i++) {
      const rowData = data[i];
      const instrumentData = {};
      let hasError = false;

      // 检查必填字段
      for (const field of requiredFields) {
        if (!rowData[field] || rowData[field].toString().trim() === '') {
          hasError = true;
          failedRows.push(`第${i + 2}行：缺少必填字段'${field}'`);
          break;
        }
      }

      if (hasError) {
        failedCount++;
        continue;
      }

      // 映射字段
      for (const [excelField, systemField] of Object.entries(fieldMapping)) {
        if (rowData[excelField] !== undefined) {
          let value = rowData[excelField];
          // 处理日期格式
      if ((excelField === '校准日期' || excelField === '复校日期') && value) {
        try {
          // 处理Excel日期格式
          if (typeof value === 'number' && value > 0) {
            // Excel日期转JavaScript日期（1900年为起点）
            const date = new Date((value - 25569) * 86400000);
            instrumentData[systemField] = date.toISOString().split('T')[0];
          } else {
            // 尝试解析常见日期格式
            const dateValue = value.toString().trim();
            let date;
            
            // 处理yyyy-mm-dd格式
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              date = new Date(dateValue);
            }
            // 处理yyyy/mm/dd格式
            else if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateValue)) {
              date = new Date(dateValue.replace(/\//g, '-'));
            }
            // 处理dd-mm-yyyy格式
            else if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
              const [dd, mm, yyyy] = dateValue.split('-');
              date = new Date(`${yyyy}-${mm}-${dd}`);
            }
            // 处理dd/mm/yyyy格式
            else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
              const [dd, mm, yyyy] = dateValue.split('/');
              date = new Date(`${yyyy}-${mm}-${dd}`);
            }
            
            if (date && !isNaN(date.getTime())) {
              instrumentData[systemField] = date.toISOString().split('T')[0];
            } else {
              instrumentData[systemField] = dateValue;
            }
          }
        } catch (error) {
          instrumentData[systemField] = value.toString().trim();
        }
      } else if (selectValueMapping[systemField] && typeof value === 'string') {
        // 处理下拉选择框值映射
        const trimmedValue = value.trim();
        // 首先尝试直接映射
        if (selectValueMapping[systemField][trimmedValue]) {
          instrumentData[systemField] = selectValueMapping[systemField][trimmedValue];
        } else if (trimmedValue === '' || trimmedValue === '请选择') {
          instrumentData[systemField] = '';
        } else {
          // 现在直接使用原始值，不再进行符号到HTML标签的转换
          instrumentData[systemField] = trimmedValue;
        }
      } else if (typeof value === 'string') {
        // 现在直接使用原始值，不再进行符号到HTML标签的转换
        instrumentData[systemField] = value.trim();
      } else {
        instrumentData[systemField] = value;
      }
        }
      }

      // 添加额外信息（只添加updatedAt，id和createdAt由add方法生成）
      instrumentData.updatedAt = new Date().toISOString();

      // 保存到存储
      const result = instrumentStorage.add(instrumentData);
      if (result) {
        importedCount++;
      } else {
        failedCount++;
        failedRows.push(`第${i + 2}行：保存失败`);
      }
    }

    // 显示导入结果
    let message = `导入完成！成功导入 ${importedCount} 条数据，失败 ${failedCount} 条数据。`;
    if (failedRows.length > 0) {
      message += '\n失败原因：\n' + failedRows.join('\n');
    }
    alert(message);

    // 刷新数据列表
    fetchInstruments();
  }

  // 处理编辑仪器
  const handleEditInstrument = (instrument) => {
    setInstrumentForm({...instrument})
    setShowAddModal(true)
    setEditingInstrumentId(instrument.id)
  }

  // 处理列拖动开始
  const handleDragStart = (column, e) => {
    setDraggedColumn(column)
    e.dataTransfer.effectAllowed = 'move'
  }

  // 处理列拖动结束
  const handleDragOver = (e) => {
    e.preventDefault()
  }

  // 处理列放置
  const handleDrop = (targetColumn) => {
    if (draggedColumn && draggedColumn !== targetColumn) {
      const newOrder = [...columnOrder]
      const draggedIndex = newOrder.indexOf(draggedColumn)
      const targetIndex = newOrder.indexOf(targetColumn)
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedColumn)
      setColumnOrder(newOrder)
    }
    setDraggedColumn(null)
  }

  // 处理列宽调整
  const handleColumnResize = (column, width) => {
    setColumnWidths(prev => ({
      ...prev,
      [column]: width
    }))
  }

  // 处理筛选条件变化 - 自动应用筛选
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilterForm(prev => ({
      ...prev,
      [name]: value
    }));
    // 重置到第一页以立即应用筛选变化
    setCurrentPage(1);
  };

  // 应用筛选
  const applyFilters = () => {
    let result = [...instruments];
    
    // 应用科室筛选
    if (filterForm.department) {
      result = result.filter(instrument => instrument.department === filterForm.department);
    }
    
    // 应用类型筛选
    if (filterForm.type) {
      result = result.filter(instrument => instrument.type === filterForm.type);
    }
    
    // 应用仪器状态筛选
    if (filterForm.instrumentStatus) {
      result = result.filter(instrument => instrument.instrumentStatus === filterForm.instrumentStatus);
    }
    
    // 应用出入库状态筛选
    if (filterForm.inOutStatus) {
      result = result.filter(instrument => instrument.inOutStatus === filterForm.inOutStatus);
    }
    
    // 应用日期范围筛选
    if (filterForm.startDate && filterForm.endDate) {
      result = result.filter(instrument => {
        const instrumentDate = new Date(instrument.createdAt || instrument.calibrationDate);
        const startDate = new Date(filterForm.startDate);
        const endDate = new Date(filterForm.endDate);
        return instrumentDate >= startDate && instrumentDate <= endDate;
      });
    }
    
    setFilteredInstruments(result);
    setCurrentPage(1); // 重置到第一页
  };

  // 重置筛选条件
  const resetFilters = () => {
    setFilterForm({
      department: '',
      type: '',
      instrumentStatus: '',
      inOutStatus: '',
      startDate: '',
      endDate: ''
    });
    setFilteredInstruments([]);
    setCurrentPage(1);
  };

  // 计算当前页显示的数据
  const getCurrentPageData = () => {
    // 先应用搜索过滤
    let result = instruments;
    if (searchQuery) {
      result = instrumentStorage.search(searchQuery);
    }
    
    // 然后应用筛选条件
    if (filteredInstruments.length > 0 || Object.values(filterForm).some(value => value)) {
      // 如果有筛选结果或筛选条件不为空，使用筛选后的数据
      result = filteredInstruments.length > 0 ? filteredInstruments : instruments;
      
      // 应用科室筛选
      if (filterForm.department) {
        result = result.filter(instrument => instrument.department === filterForm.department);
      }
      
      // 应用类型筛选
      if (filterForm.type) {
        result = result.filter(instrument => instrument.type === filterForm.type);
      }
      
      // 应用仪器状态筛选
      if (filterForm.instrumentStatus) {
        result = result.filter(instrument => instrument.instrumentStatus === filterForm.instrumentStatus);
      }
      
      // 应用出入库状态筛选
      if (filterForm.inOutStatus) {
        result = result.filter(instrument => instrument.inOutStatus === filterForm.inOutStatus);
      }
      
      // 应用日期范围筛选
      if (filterForm.startDate && filterForm.endDate) {
        result = result.filter(instrument => {
          const instrumentDate = new Date(instrument.createdAt || instrument.calibrationDate);
          const startDate = new Date(filterForm.startDate);
          const endDate = new Date(filterForm.endDate);
          return instrumentDate >= startDate && instrumentDate <= endDate;
        });
      }
    }
    
    // 然后应用分页逻辑
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return result.slice(startIndex, endIndex)
  }

  // 计算总页数 - 考虑筛选后的结果
  const totalPages = Math.ceil((filteredInstruments.length > 0 ? filteredInstruments.length : instruments.length) / itemsPerPage)

  // 处理分页
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // 列配置
  const columnConfig = {
    checkbox: { label: '', width: 40, sortable: false },
    name: { label: '名称', width: 120, sortable: true },
    model: { label: '型号', width: 100, sortable: true },
    managementNumber: { label: '管理编号', width: 120, sortable: true },
    factoryNumber: { label: '出厂编号', width: 100, sortable: true },
    manufacturer: { label: '生产厂家', width: 120, sortable: true },
    type: { label: '类型', width: 80, sortable: true },
    measurementRange: { label: '测量范围', width: 120, sortable: false },
    measurementUncertainty: { label: '测量不确定度', width: 120, sortable: false },
    calibrationStatus: { label: '检定/校准', width: 100, sortable: true },
    calibrationDate: { label: '校准日期', width: 100, sortable: true },
    recalibrationDate: { label: '复校日期', width: 100, sortable: true },
    period: { label: '周期', width: 80, sortable: false },
    traceabilityAgency: { label: '溯源机构', width: 120, sortable: true },
    traceabilityCertificate: { label: '溯源证书', width: 120, sortable: true },
    storageLocation: { label: '存放位置', width: 120, sortable: true },
    department: { label: '科室', width: 80, sortable: true },
    instrumentStatus: { label: '仪器状态', width: 100, sortable: true },
    inOutStatus: { label: '出入库状态', width: 100, sortable: true },
    remarks: { label: '备注', width: 150, sortable: false },
    attachments: { label: '附件', width: 120, sortable: false },
    action: { label: '操作', width: 100, sortable: false }
  }

  const toggleSubmenu = (menuId) => {
    setExpandedSubmenu(expandedSubmenu === menuId ? null : menuId)
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600)
      if (window.innerWidth > 600) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 添加模拟数据的函数
  const initializeMockData = () => {
    // 检查是否已有数据
    const existingData = instrumentStorage.getAll();
    if (existingData.length === 0) {
      console.log('初始化模拟数据');
      
      // 创建一些出库状态的仪器用于测试延期功能
      const mockInstruments = [
        {
          name: '数字万用表',
          model: 'FLUKE-8846A',
          managementNumber: 'SN2024001',
          measurementRange: '0-1000V',
          instrumentStatus: 'normal',
          inOutStatus: 'out',
          outboundTime: new Date().toLocaleString('zh-CN'),
          operator: '管理员',
          remarks: '用于电气测量'
        },
        {
          name: '游标卡尺',
          model: 'MITUTOYO-500-196',
          managementNumber: 'SN2024002',
          measurementRange: '0-150mm',
          instrumentStatus: 'normal',
          inOutStatus: 'out',
          outboundTime: new Date().toLocaleString('zh-CN'),
          operator: '管理员',
          remarks: '用于长度测量'
        },
        {
          name: '温湿度计',
          model: 'TESTO-608-H1',
          managementNumber: 'SN2024003',
          measurementRange: '-20~70°C, 0-100%RH',
          instrumentStatus: 'normal',
          inOutStatus: 'in',
          inboundTime: new Date().toLocaleString('zh-CN'),
          operator: '管理员',
          remarks: '用于环境监测'
        }
      ];
      
      // 添加模拟数据
      mockInstruments.forEach(instrument => {
        instrumentStorage.add(instrument);
      });
      
      console.log('模拟数据添加完成');
    }
  };
  
  // 组件挂载时和切换到仪器管理时都获取数据
  useEffect(() => {
    initializeMockData();
    fetchInstruments();
  }, [])

  // 切换到仪器管理时刷新数据
  useEffect(() => {
    if (activeMenuItem === 'instrument-management') {
      fetchInstruments()
    }
  }, [activeMenuItem])

  const handleMenuItemClick = (itemId) => {
    setActiveMenuItem(itemId)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="main-container">
      <header className="main-header">
        {/* 通知组件 */}
        {alertMessage && (
          <Alert
            message={alertMessage.message}
            type={alertMessage.type}
            duration={3000}
            onClose={() => setAlertMessage(null)}
            position="top-right"
          />
        )}
        <div className="header-left">
          {isMobile && (
            <button className="menu-toggle" onClick={toggleSidebar}>
              ☰
            </button>
          )}
          <h1>标准器/物质管理系统</h1>
        </div>
        <div className="header-right">
          <button className="logout-button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
          <nav className="sidebar-nav">
            {menuItems.map(item => {
              if (item.submenu) {
                return (
                  <div key={item.id} className="nav-group">
                    <button
                      className={`nav-item ${activeMenuItem === item.id ? 'active' : ''}`}
                      onClick={() => toggleSubmenu(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      <span className={`nav-arrow ${expandedSubmenu === item.id ? 'open' : ''}`}>
                        ▼
                      </span>
                    </button>
                    {expandedSubmenu === item.id && (
                      <div className="submenu">
                        {item.submenu.map(subItem => (
                          <button
                            key={subItem.id}
                            className={`submenu-item ${activeMenuItem === subItem.id ? 'active' : ''}`}
                            onClick={() => {
                              handleMenuItemClick(subItem.id)
                              if (isMobile) setSidebarOpen(false)
                            }}
                          >
                            <span className="nav-icon">{subItem.icon}</span>
                            <span className="nav-label">{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button
                  key={item.id}
                  className={`nav-item ${activeMenuItem === item.id ? 'active' : ''}`}
                  onClick={() => handleMenuItemClick(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="main-content">
          <div className="page-header">
            <h2>{menuItems.find(item => item.id === activeMenuItem)?.label || 
                menuItems.find(item => item.submenu?.some(sub => sub.id === activeMenuItem))?.submenu.find(sub => sub.id === activeMenuItem)?.label || 
                '欢迎使用标准器/物质管理系统'}</h2>
            <div className="header-divider"></div>
          </div>

          {activeMenuItem === 'instrument-management' && (
            <>
              {/* 格式提示 */}
              <div className="format-tips">
                <p style={{fontSize: '12px', color: '#666', margin: '5px 0'}}>斜体：&lt;em&gt;U&lt;/em&gt;，下标：&lt;sub&gt;rel&lt;/sub&gt;，上标：&lt;sup&gt;-6&lt;/sup&gt;</p>
              </div>
              {/* 测试功能按钮 */}
              <div className="test-buttons" style={{
                backgroundColor: 'rgba(240, 240, 240, 0.9)',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '10px',
                display: 'flex',
                gap: '10px',
                border: '1px solid #ddd',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={testStorage} 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  测试存储
                </button>
                <button 
                  onClick={addTestInstrument} 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  添加测试仪器
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm('确定要清空所有存储的数据吗？')) {
                      localStorage.removeItem('standard-instruments')
                      fetchInstruments()
                      alert('存储已清空！')
                    }
                  }} 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  清空存储
                </button>
                <button 
                  onClick={() => navigate('/test-format')} 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#9C27B0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  测试文本格式
                </button>
              </div>
              <div className="instrument-actions">
                <button className="action-button add-button" onClick={openAddModal}>
                  <span>➕</span>
                  <span>添加仪器</span>
                </button>
                <button className="action-button delete-button" onClick={handleBatchDelete}>
                  <span>🗑️</span>
                  <span>批量删除</span>
                </button>
                <button className="action-button import-button" onClick={handleImportClick}>
                  <span>📥</span>
                  <span>导入</span>
                </button>
                <input
                  type="file"
                  id="excel-import-input"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleExcelFileChange}
                />
                <button className="action-button export-button">
                  <span>📤</span>
                  <span>导出</span>
                </button>
              </div>

              {/* 搜索和筛选区域 - 重新设计样式 */}
              <div style={{ 
                display: 'flex', 
                gap: '20px', 
                marginBottom: '20px', 
                alignItems: 'center',
                flexWrap: 'nowrap',
                width: '100%'
              }}>
                {/* 搜索区域 */}
                <div style={{ 
                  flex: '1', 
                  minWidth: '280px',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'relative',
                    width: '100%'
                  }}>
                    <input
                      type="text"
                      placeholder="搜索仪器..."
                      value={searchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchQuery(value);
                        // 生成搜索建议
                        if (value.trim().length > 0) {
                          const results = instrumentStorage.search(value);
                          const allValues = new Set();
                          results.forEach(item => {
                            Object.values(item).forEach(val => {
                              if (typeof val === 'string' && val.length > 0) {
                                allValues.add(val);
                              }
                            });
                          });
                          const suggestionList = Array.from(allValues)
                            .filter(val => 
                              val.toLowerCase().includes(value.toLowerCase()) ||
                              pinyin(val, { style: pinyin.STYLE_NORMAL, heteronym: false }).join('').toLowerCase().includes(value.toLowerCase())
                            )
                            .slice(0, 10);
                          setSuggestions(suggestionList);
                          setShowSuggestions(true);
                        } else {
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (suggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 16px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#4a90e2';
                      }}
                      onMouseLeave={(e) => {
                        if (!e.target.matches(':focus')) {
                          e.target.style.borderColor = '#e0e0e0';
                        }
                      }}
                    />
                    {/* 搜索图标 */}
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#999',
                      pointerEvents: 'none'
                    }}>
                      🔍
                    </div>
                    {/* 搜索建议下拉菜单 */}
                    {showSuggestionsInOut && suggestionsInOut.length > 0 && (
                      <div style={{ 
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        right: '0',
                        marginTop: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: '1000'
                      }}>
                        {suggestionsInOut.map((suggestion, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setSearchQueryInOut(suggestion);
                              setShowSuggestionsInOut(false);
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#333',
                              borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#f5f7fa';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#ffffff';
                            }}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 筛选区域 - 美化设计 */}
                <div style={{ 
                  flex: '2', 
                  backgroundColor: '#f8f9fa', 
                  padding: '16px', 
                  borderRadius: '12px', 
                  border: '1px solid #e9ecef',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    gap: '16px',
                    width: '100%'
                  }}>
                    {/* 筛选控件样式统一 */}
                    {['department', 'type', 'instrumentStatus', 'inOutStatus'].map((field, index) => {
                      const labels = {
                        department: '部门',
                        type: '类型',
                        instrumentStatus: '状态',
                        inOutStatus: '库位'
                      };
                      
                      return (
                        <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ 
                            fontSize: '14px', 
                            color: '#666',
                            whiteSpace: 'nowrap'
                          }}>
                            {labels[field]}:
                          </label>
                          <select
                            id={`filter-${field}`}
                            name={field}
                            value={filterForm[field]}
                            onChange={handleFilterChange}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d0d7de',
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                              outline: 'none',
                              minWidth: '100px',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.borderColor = '#4a90e2';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.borderColor = '#d0d7de';
                            }}
                          >
                            <option value="">全部</option>
                            {field === 'department' && (
                              <>
                                <option value="thermal">热工</option>
                                <option value="physical">理化</option>
                              </>
                            )}
                            {field === 'type' && (
                              <>
                                <option value="standard">标准器</option>
                                <option value="reference-material">标准物质</option>
                                <option value="auxiliary">辅助设备</option>
                              </>
                            )}
                            {field === 'instrumentStatus' && (
                              <>
                                <option value="in-use">使用中</option>
                                <option value="overdue">超期使用</option>
                                <option value="stopped">停用</option>
                                <option value="used">已使用</option>
                              </>
                            )}
                            {field === 'inOutStatus' && (
                              <>
                                <option value="in">已入库</option>
                                <option value="out">已出库</option>
                              </>
                            )}
                          </select>
                        </div>
                      );
                    })}
                    
                    {/* 日期范围选择 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                      <label style={{ 
                        fontSize: '14px', 
                        color: '#666',
                        whiteSpace: 'nowrap'
                      }}>
                        日期范围:
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={filterForm.startDate}
                        onChange={handleFilterChange}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #d0d7de',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          transition: 'all 0.3s ease'
                        }}
                      />
                      <span style={{ color: '#999', fontSize: '14px' }}>至</span>
                      <input
                        type="date"
                        name="endDate"
                        value={filterForm.endDate}
                        onChange={handleFilterChange}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #d0d7de',
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          transition: 'all 0.3s ease'
                        }}
                      />
                    </div>
                    
                    {/* 重置按钮 - 美化设计 */}
                    <div style={{ marginLeft: 'auto' }}>
                      <button
                        onClick={resetFilters}
                        style={{
                          padding: '9px 20px',
                          backgroundColor: '#6c757d',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '500',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#5a6268';
                          e.target.style.transform = 'translateY(-1px)';
                          e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#6c757d';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                        }}
                        onMouseDown={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                        }}
                      >
                        重置筛选
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 右侧功能按钮 */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  
                  <button 
                    className="action-btn export-btn"
                    onClick={() => {
                      alert('导出功能待实现');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#52c41a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background-color 0.3s'
                    }}
                  >
                    导出
                  </button>
                </div>
              </div>

              <div className="instrument-list-container">
                <table className="instrument-table" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      {columnOrder.map(column => {
                        const config = columnConfig[column]
                        return (
                          <th
                            key={column}
                            className={column === 'checkbox' ? 'checkbox-col' : column === 'action' ? 'action-col' : ''}
                            style={{ 
                              width: `${columnWidths[column] || config.width}px`,
                              cursor: column !== 'checkbox' && column !== 'action' ? 'grab' : 'default'
                            }}
                            draggable={column !== 'checkbox' && column !== 'action'}
                            onDragStart={(e) => handleDragStart(column, e)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(column)}
                          >
                            {column === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={selectAll && instruments.length > 0}
                                onChange={handleSelectAll}
                              />
                            ) : (
                              <div className="column-header">
                                {config.label}
                                {column !== 'checkbox' && column !== 'action' && (
                                  <div 
                                    className="column-resizer"
                                    onMouseDown={(e) => {
                                      const startX = e.pageX
                                      const startWidth = columnWidths[column] || config.width
                                      
                                      const handleMouseMove = (moveEvent) => {
                                        const newWidth = startWidth + (moveEvent.pageX - startX)
                                        if (newWidth > 50) { // 最小宽度限制
                                          handleColumnResize(column, newWidth)
                                        }
                                      }
                                      
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove)
                                        document.removeEventListener('mouseup', handleMouseUp)
                                      }
                                      
                                      document.addEventListener('mousemove', handleMouseMove)
                                      document.addEventListener('mouseup', handleMouseUp)
                                      e.preventDefault()
                                    }}
                                  >
                                    <div className="resizer-handle"></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {getCurrentPageData().length === 0 ? (
                      <tr>
                        <td colSpan={columnOrder.length} className="no-data">暂无仪器数据</td>
                      </tr>
                    ) : (
                      getCurrentPageData().map(instrument => (
                        <tr key={instrument.id} className={instrument.instrumentStatus === 'used' ? 'used-instrument' : ''}>
                          {columnOrder.map(column => {
                            switch(column) {
                              case 'checkbox':
                                return (
                                  <td key={column} className="checkbox-col">
                                    <input
                                      type="checkbox"
                                      checked={selectedInstruments.includes(instrument.id)}
                                      onChange={() => handleInstrumentSelect(instrument.id)}
                                    />
                                  </td>
                                )
                              case 'name':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.name) }}></td>
                              case 'model':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.model) }}></td>
                              case 'managementNumber':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.managementNumber) }}></td>
                              case 'factoryNumber':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.factoryNumber) }}></td>
                              case 'manufacturer':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.manufacturer) }}></td>
                              case 'type':
                                return (
                                  <td key={column}>
                                    {instrument.type === 'standard' && '标准器'}
                                    {instrument.type === 'reference-material' && '标准物质'}
                                    {instrument.type === 'auxiliary' && '辅助设备'}
                                    {!instrument.type && '-'}
                                  </td>
                                )
                              case 'measurementRange':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.measurementRange) }}></td>
                              case 'measurementUncertainty':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.measurementUncertainty) }}></td>
                              case 'calibrationStatus':
                                return (
                                  <td key={column}>
                                    {instrument.calibrationStatus === 'verification' && '检定'}
                                    {instrument.calibrationStatus === 'calibration' && '校准'}
                                    {instrument.calibrationStatus === 'calibrated' && '已校准'}
                                    {instrument.calibrationStatus === 'to-calibrate' && '待校准'}
                                    {instrument.calibrationStatus === 'uncalibrated' && '未校准'}
                                    {!instrument.calibrationStatus && '-'}
                                  </td>
                                )
                              case 'calibrationDate':
                                return <td key={column}>{instrument.calibrationDate || '-'}</td>
                              case 'recalibrationDate':
                                return <td key={column}>{instrument.recalibrationDate || '-'}</td>
                              case 'period':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.period) }}></td>
                              case 'traceabilityAgency':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.traceabilityAgency) }}></td>
                              case 'traceabilityCertificate':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.traceabilityCertificate) }}></td>
                              case 'storageLocation':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.storageLocation) }}></td>
                              case 'department':
                                return (
                                  <td key={column}>
                                    {instrument.department === 'thermal' && '热工'}
                                    {instrument.department === 'physical' && '理化'}
                                    {(!instrument.department || (instrument.department !== 'thermal' && instrument.department !== 'physical')) && '-'}
                                  </td>
                                )
                              case 'instrumentStatus':
                                return (
                                  <td key={column}>
                                    {instrument.instrumentStatus === 'in-use' && '使用中'}
                                    {instrument.instrumentStatus === 'overdue' && '超期使用'}
                                    {instrument.instrumentStatus === 'stopped' && '停用'}
                                    {instrument.instrumentStatus === 'used' && (
                                      <span className="status-used">已使用</span>
                                    )}
                                    {!instrument.instrumentStatus && '-'}
                                  </td>
                                )
                              case 'inOutStatus':
                                return (
                                  <td key={column}>
                                    {instrument.inOutStatus === 'in' && '已入库'}
                                    {instrument.inOutStatus === 'out' && '已出库'}
                                    {!instrument.inOutStatus && '-'}
                                  </td>
                                )
                              case 'remarks':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.remarks) }}></td>
                              case 'attachments':
                                return <td key={column} dangerouslySetInnerHTML={{ __html: formatText(instrument.attachments) }}></td>
                              case 'action':
                                return (
                                  <td key={column} className="action-col">
                                    <button 
                                      className="edit-btn" 
                                      onClick={() => handleEditInstrument(instrument)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      编辑
                                    </button>
                                    <button 
                                      className="delete-btn" 
                                      onClick={() => handleDeleteInstrument(instrument.id)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      删除
                                    </button>
                                  </td>
                                )
                              default:
                                return <td key={column}>-</td>
                            }
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页控件 */}
              {(getCurrentPageData().length > 0 || filteredInstruments.length > 0 || instruments.length > 0) && (
                <div className="pagination">
                  <div className="pagination-info">
                    显示 {getCurrentPageData().length} 条，共 {(filteredInstruments.length > 0 ? filteredInstruments.length : instruments.length)} 条
                  </div>
                  <div className="pagination-controls">
                    <button 
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      上一页
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // 简单的分页逻辑，始终显示前5页或总页数中的较小值
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button 
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      下一页
                    </button>
                    <span className="pagination-ellipsis">...</span>
                    <button 
                      onClick={() => goToPage(totalPages)}
                      className={`pagination-btn ${currentPage === totalPages ? 'active' : ''}`}
                    >
                      {totalPages}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 信息看板占位符 */}
          {activeMenuItem === 'dashboard' && (
            <div className="dashboard-placeholder">
              <p>信息看板功能正在开发中...</p>
            </div>
          )}

          {/* 仪器出入界面 */}
          {activeMenuItem === 'instrument-inout' && (
            <>
              {/* 搜索和筛选区域 - 独立的搜索框 */}
              <div style={{ 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '20px', 
                alignItems: 'center',
                flexWrap: 'nowrap',
                width: '100%'
              }}>
                {/* 搜索区域 */}
                <div style={{ 
                  flex: '0 0 60%', 
                  minWidth: '280px',
                  position: 'relative'
                }}>
                  <div style={{ 
                    position: 'relative',
                    width: '100%'
                  }}>
                    <input
                      type="text"
                      placeholder="搜索仪器..."
                      value={searchQueryInOut}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchQueryInOut(value);
                        // 生成搜索建议（使用独立的建议状态）
                        if (value.trim().length > 0) {
                          const results = instrumentStorage.search(value);
                          const allValues = new Set();
                          results.forEach(item => {
                            Object.values(item).forEach(val => {
                              if (typeof val === 'string' && val.length > 0) {
                                allValues.add(val);
                              }
                            });
                          });
                          const suggestionList = Array.from(allValues)
                            .filter(val => 
                              val.toLowerCase().includes(value.toLowerCase()) ||
                              pinyin(val, { style: pinyin.STYLE_NORMAL, heteronym: false }).join('').toLowerCase().includes(value.toLowerCase())
                            )
                            .slice(0, 10);
                          setSuggestionsInOut(suggestionList);
                          setShowSuggestionsInOut(true);
                        } else {
                          setSuggestionsInOut([]);
                          setShowSuggestionsInOut(false);
                        }
                      }}
                      onFocus={() => {
                        if (suggestionsInOut.length > 0) {
                          setShowSuggestionsInOut(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowSuggestionsInOut(false), 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowSuggestionsInOut(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 16px',
                        border: '2px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                        transition: 'all 0.3s ease',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#4a90e2';
                      }}
                      onMouseLeave={(e) => {
                        if (!e.target.matches(':focus')) {
                          e.target.style.borderColor = '#e0e0e0';
                        }
                      }}
                    />
                    {/* 搜索图标 */}
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#999',
                      pointerEvents: 'none'
                    }}>
                      🔍
                    </div>
                    {/* 搜索建议下拉菜单 */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '0',
                        right: '0',
                        marginTop: '8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: '1000'
                      }}>
                        {suggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setSearchQuery(suggestion);
                              setShowSuggestions(false);
                            }}
                            style={{
                              padding: '12px 16px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#333',
                              borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#f5f7fa';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#ffffff';
                            }}
                          >
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 右侧功能按钮 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  alignItems: 'center'
                }}>

                  
                  <button 
                    className="action-btn export-btn"
                    onClick={() => {
                      alert('导出功能待实现');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#52c41a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'background-color 0.3s'
                    }}
                  >
                    导出
                  </button>
                </div>
              </div>
              
              {/* 仪器列表容器 */}
              <div className="instrument-list-container">
                <table className="instrument-table">
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>名称</th>
                      <th style={{ width: '100px' }}>型号</th>
                      <th style={{ width: '150px' }}>管理编号</th>
                      <th style={{ width: '120px' }}>测量范围</th>
                      <th style={{ width: '80px' }}>仪器状态</th>
                      <th style={{ width: '100px' }}>操作人</th>
                      <th style={{ width: '100px' }}>出入库状态</th>
                      <th style={{ width: '120px' }}>出库时间</th>
                      <th style={{ width: '120px' }}>入库时间</th>
                      <th style={{ minWidth: '150px' }}>备注</th>
                      <th style={{ width: '200px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 根据搜索框输入动态显示搜索结果 */}
                    {(() => {
                      // 获取搜索结果（使用独立的搜索状态）
                      let searchResults = [];
                      if (searchQueryInOut.trim()) {
                        // 当搜索框有内容时，从所有仪器数据中搜索
                        searchResults = instrumentStorage.search(searchQueryInOut);
                      } else {
                        // 当搜索框为空时，显示当天进行过出入库操作的仪器或延期未到期的仪器
    const allInstruments = instrumentStorage.getAll();
    const today = new Date().toLocaleDateString('zh-CN');
    console.log('Filtering instruments for today:', today);
    
    // 调试所有仪器的状态
    console.log('All instruments count:', allInstruments.length);
    allInstruments.forEach(instrument => {
      console.log('Instrument:', instrument.managementNumber, 
                  'outboundTime:', instrument.outboundTime, 
                  'inboundTime:', instrument.inboundTime, 
                  'displayUntil:', instrument.displayUntil, 
                  'deletedTodayRecord:', instrument.deletedTodayRecord);
    });
    
    searchResults = allInstruments.filter(instrument => {
      // 检查是否是当天进行过操作且未删除记录的仪器
      const hasTodayOperation = (instrument.outboundTime && instrument.outboundTime.includes(today.split('/')[2])) || 
                               (instrument.inboundTime && instrument.inboundTime.includes(today.split('/')[2])) && 
                               !instrument.deletedTodayRecord;
      // 检查是否是延期未到期的仪器
      const isDelayedAndNotExpired = instrument.displayUntil && instrument.displayUntil >= today && !instrument.deletedTodayRecord;
      
      const shouldDisplay = hasTodayOperation || isDelayedAndNotExpired;
      if (shouldDisplay) {
        console.log('Displaying instrument:', instrument.managementNumber, 'Reason:', hasTodayOperation ? 'Today operation' : 'Delayed');
      }
      
      return shouldDisplay;
    });
                      }
                       
                      // 如果没有搜索结果，显示提示信息
                      if (searchResults.length === 0) {
                        return (
                          <tr>
                            <td colSpan="11" style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              {searchQueryInOut.trim() ? '未找到匹配的仪器' : '今天暂无出入库操作记录'}
                            </td>
                          </tr>
                        );
                      }
                      
                      // 显示搜索结果
                      return searchResults.map((instrument) => (
                        <tr key={instrument.managementNumber || instrument.id || Math.random()}>
                          <td>{instrument.name || '-'}</td>
                          <td>{instrument.model || '-'}</td>
                          <td>{instrument.managementNumber || '-'}</td>
                          <td>{instrument.measurementRange || '-'}</td>
                          <td>
                            {instrument.instrumentStatus === 'normal' && <span className="status-badge normal">正常</span>}
                            {instrument.instrumentStatus === 'abnormal' && <span className="status-badge abnormal">异常</span>}
                            {instrument.instrumentStatus === 'repairing' && <span className="status-badge repairing">维修中</span>}
                            {instrument.instrumentStatus === 'used' && <span className="status-badge normal">已使用</span>}
                            {!instrument.instrumentStatus && '-'} 
                          </td>
                          <td>{instrument.operator || '-'}</td>
                          <td>
                            {instrument.inOutStatus === 'in' && <span className="status-badge normal">已入库</span>}
                            {instrument.inOutStatus === 'out' && <span className="status-badge abnormal">已出库</span>}
                            {!instrument.inOutStatus && '-'} 
                          </td>
                          <td>{instrument.outboundTime || '-'}</td>
                          <td>{instrument.inboundTime || '-'}</td>
                          <td>{instrument.remarks || '-'}</td>
                          <td className="action-col">
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              <button 
                                className="action-btn out-btn" 
                                onClick={() => handleOutbound(instrument.managementNumber)}
                                disabled={!instrument.managementNumber}
                              >
                                出库
                              </button>
                              <button 
                                className="action-btn in-btn" 
                                onClick={() => handleInbound(instrument.managementNumber)}
                                disabled={!instrument.managementNumber}
                              >
                                入库
                              </button>
                              <button 
                                className="action-btn use-btn" 
                                onClick={() => handleUseInstrument(instrument.managementNumber)}
                                disabled={!instrument.managementNumber}
                              >
                                使用
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                              <button 
                                className="action-btn detail-btn" 
                                onClick={() => showInstrumentDetails(instrument)}
                                disabled={!instrument.managementNumber}
                              >
                                详情
                              </button>
                              <button 
                                className="action-btn delay-btn" 
                                onClick={() => handleDelayInstrument(instrument.managementNumber)}
                                disabled={!instrument.managementNumber}
                              >
                                延期
                              </button>
                              <button 
                                className="action-btn delete-btn" 
                                onClick={() => handleDeleteTodayRecord(instrument.managementNumber)}
                                disabled={!instrument.managementNumber}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 添加/编辑仪器表单 */}
          {showAddModal && (
            <div className="modal-overlay" onClick={closeAddModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{editingInstrumentId ? '编辑仪器' : '添加仪器'}</h3>
                  <button className="modal-close" onClick={closeAddModal}>&times;</button>
                </div>
                <div className="modal-body">
                <form onSubmit={handleSubmit} className="instrument-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor="type">类型</label>
                        <select
                          id="type"
                          name="type"
                          value={instrumentForm.type}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">请选择</option>
                          <option value="standard">标准器</option>
                          <option value="reference-material">标准物质</option>
                          <option value="auxiliary">辅助设备</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="name">名称</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={instrumentForm.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="model">型号</label>
                        <input
                          type="text"
                          id="model"
                          name="model"
                          value={instrumentForm.model}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="factoryNumber">出厂编号</label>
                        <input
                          type="text"
                          id="factoryNumber"
                          name="factoryNumber"
                          value={instrumentForm.factoryNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="managementNumber">管理编号</label>
                        <input
                          type="text"
                          id="managementNumber"
                          name="managementNumber"
                          value={instrumentForm.managementNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="manufacturer">生产厂家</label>
                        <input
                          type="text"
                          id="manufacturer"
                          name="manufacturer"
                          value={instrumentForm.manufacturer}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="measurementRange">测量范围</label>
                        <input
                          type="text"
                          id="measurementRange"
                          name="measurementRange"
                          value={instrumentForm.measurementRange}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="measurementUncertainty">测量不确定度</label>
                        <input
                          type="text"
                          id="measurementUncertainty"
                          name="measurementUncertainty"
                          value={instrumentForm.measurementUncertainty}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="calibrationStatus">检定/校准</label>
                        <select
                          id="calibrationStatus"
                          name="calibrationStatus"
                          value={instrumentForm.calibrationStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="verification">检定</option>
                          <option value="calibration">校准</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="calibrationDate">校准日期</label>
                        <input
                          type="date"
                          id="calibrationDate"
                          name="calibrationDate"
                          value={instrumentForm.calibrationDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="recalibrationDate">复校日期</label>
                        <input
                          type="date"
                          id="recalibrationDate"
                          name="recalibrationDate"
                          value={instrumentForm.recalibrationDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="period">周期</label>
                        <input
                          type="text"
                          id="period"
                          name="period"
                          value={instrumentForm.period}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="traceabilityAgency">溯源机构</label>
                        <input
                          type="text"
                          id="traceabilityAgency"
                          name="traceabilityAgency"
                          value={instrumentForm.traceabilityAgency}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="traceabilityCertificate">溯源证书</label>
                        <input
                          type="text"
                          id="traceabilityCertificate"
                          name="traceabilityCertificate"
                          value={instrumentForm.traceabilityCertificate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="department">科室</label>
                        <select
                          id="department"
                          name="department"
                          value={instrumentForm.department}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="thermal">热工</option>
                          <option value="physical">理化</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="storageLocation">存放位置</label>
                        <input
                          type="text"
                          id="storageLocation"
                          name="storageLocation"
                          value={instrumentForm.storageLocation}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="instrumentStatus">仪器状态</label>
                        <select
                          id="instrumentStatus"
                          name="instrumentStatus"
                          value={instrumentForm.instrumentStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="in-use">使用中</option>
                          <option value="overdue">超期使用</option>
                          <option value="stopped">停用</option>
                          <option value="used">已使用</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="inOutStatus">出入库状态</label>
                        <select
                          id="inOutStatus"
                          name="inOutStatus"
                          value={instrumentForm.inOutStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="in">已入库</option>
                          <option value="out">已出库</option>
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label htmlFor="remarks">备注</label>
                        <textarea
                          id="remarks"
                          name="remarks"
                          value={instrumentForm.remarks}
                          onChange={handleInputChange}
                          rows="3"
                        ></textarea>
                      </div>
                      <div className="form-group full-width">
                        <label htmlFor="attachments">附件</label>
                        <input
                          type="file"
                          id="attachments"
                          name="attachments"
                          onChange={(e) => setInstrumentForm(prev => ({
                            ...prev,
                            attachments: e.target.files[0]?.name || ''
                          }))}
                        />
                        {instrumentForm.attachments && (
                          <p className="file-name">已选择: {instrumentForm.attachments}</p>
                        )}
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="cancel-button" onClick={closeAddModal}>
                        取消
                      </button>
                      <button type="submit" className="submit-button">
                        {editingInstrumentId ? '更新' : '确认添加'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 仪器详情模态框 */}
      {showDetailModal && selectedInstrument && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>仪器详情</h2>
              <button 
                className="close-button" 
                onClick={() => setShowDetailModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body merged-detail-container">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">名称：</span>
                  <span className="detail-value">{selectedInstrument.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">型号：</span>
                  <span className="detail-value">{selectedInstrument.model}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">管理编号：</span>
                  <span className="detail-value">{selectedInstrument.managementNumber}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">出厂编号：</span>
                  <span className="detail-value">{selectedInstrument.factoryNumber}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">生产厂商：</span>
                  <span className="detail-value">{selectedInstrument.manufacturer}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">类型：</span>
                  <span className="detail-value">
                    {selectedInstrument.type === 'standard' ? '标准器' : 
                     selectedInstrument.type === 'auxiliary' ? '辅助设备' : selectedInstrument.type}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">测量范围：</span>
                  <span className="detail-value">{selectedInstrument.measurementRange}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">测量不确定度：</span>
                  <span className="detail-value">{selectedInstrument.measurementUncertainty}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">校准状态：</span>
                  <span className="detail-value">
                    {selectedInstrument.calibrationStatus === 'calibration' ? '校准' : 
                     selectedInstrument.calibrationStatus === 'verification' ? '检定' : selectedInstrument.calibrationStatus}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">校准日期：</span>
                  <span className="detail-value">{selectedInstrument.calibrationDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">复校日期：</span>
                  <span className="detail-value">{selectedInstrument.recalibrationDate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">校准周期：</span>
                  <span className="detail-value">{selectedInstrument.period}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">溯源机构：</span>
                  <span className="detail-value">{selectedInstrument.traceabilityAgency}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">溯源证书：</span>
                  <span className="detail-value">{selectedInstrument.traceabilityCertificate}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">存放位置：</span>
                  <span className="detail-value">{selectedInstrument.storageLocation}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">科室：</span>
                  <span className="detail-value">
                    {selectedInstrument.department === 'thermal' ? '热工' : 
                     selectedInstrument.department === 'physical' ? '理化' : selectedInstrument.department}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">仪器状态：</span>
                  <span className="detail-value">
                    {selectedInstrument.instrumentStatus === 'available' ? '可用' : 
                     selectedInstrument.instrumentStatus === 'in-use' ? '使用中' : 
                     selectedInstrument.instrumentStatus === 'maintenance' ? '维修中' : 
                     selectedInstrument.instrumentStatus === 'used' ? '已使用' : selectedInstrument.instrumentStatus}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">出入库状态：</span>
                  <span className="detail-value">
                    {selectedInstrument.inOutStatus === 'in' ? '入库' : 
                     selectedInstrument.inOutStatus === 'out' ? '出库' : selectedInstrument.inOutStatus}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">备注：</span>
                  <span className="detail-value">{selectedInstrument.remarks}</span>
                </div>
                {selectedInstrument.outboundTime && (
                  <div className="detail-item">
                    <span className="detail-label">出库时间：</span>
                    <span className="detail-value">{selectedInstrument.outboundTime}</span>
                  </div>
                )}
                {selectedInstrument.inboundTime && selectedInstrument.inboundTime !== '-' && (
                  <div className="detail-item">
                    <span className="detail-label">入库时间：</span>
                    <span className="detail-value">{selectedInstrument.inboundTime}</span>
                  </div>
                )}
                {selectedInstrument.operator && (
                  <div className="detail-item">
                    <span className="detail-label">操作人：</span>
                    <span className="detail-value">{selectedInstrument.operator}</span>
                  </div>
                )}
                {selectedInstrument.expectedReturnDate && (
                  <div className="detail-item">
                    <span className="detail-label">预计归还日期：</span>
                    <span className="detail-value">{selectedInstrument.expectedReturnDate}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-button" 
                onClick={() => setShowDetailModal(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 延迟操作模态框 */}
      <DelayModal
        isOpen={showDelayModal}
        onClose={handleDelayCancel}
        onConfirm={handleDelayConfirm}
        managementNumber={selectedManagementNumber}
      />

      <footer className="main-footer">
        <p>&copy; 2025 标准器/物质管理系统</p>
      </footer>
    </div>
  );
}

export default MainPageFix