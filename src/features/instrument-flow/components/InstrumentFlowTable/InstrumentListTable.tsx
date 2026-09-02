import React, { useMemo, useCallback, useState } from 'react';
import { App, Modal, Form, Select, InputNumber, Checkbox, Spin } from 'antd';
import apiClient from '../../../../services/apiClient';
import DataTable from '../../../../components/UI/DataTable';
import Pagination from '../../../../components/UI/Pagination';
import type { InstrumentTableColumn } from '../../../../components/UI/InstrumentTableColumns';
import TableColumns from './TableColumns';
import styles from './InstrumentFlowTable.module.css';
import useInstrumentActions from '../../hooks/useInstrumentActions';
import { useSystemSettings } from '../../../system-settings/hooks/useSystemSettings';
import type { Instrument } from '../../types';
import { useInstrumentTableData } from '../../hooks/useInstrumentTableData';
import useResponsive from '../../../../hooks/useResponsive';
import InstrumentCard from './InstrumentCard';
import {
  buildCapacityOptions,
  getBlockedFlowActionMessage,
  getInstrumentCapacityBase,
  isMaterialInstrument,
} from './instrumentListTableUtils';

interface InstrumentListTableProps {
  searchQuery?: string;
  flowStatusFilter?: string | undefined;
  typeFilter?: string | undefined;
  departmentFilter?: string | undefined;
  onRefresh?: () => void;
  onLoadingChange?: (loading: boolean) => void;
  onViewDetail?: (instrument: Instrument) => void;
  onReservation?: (instrument: Instrument) => void;
  onOpenUse?: (instrument: Instrument) => void;
  onOpenCheckIn?: (instrument: Instrument) => void;
  onOpenCheckOut?: (instrument: Instrument) => void;
  onOpenBorrow?: (instrument: Instrument) => void;
}

const InstrumentListTable: React.FC<InstrumentListTableProps> = ({ 
  searchQuery = '',
  flowStatusFilter,
  typeFilter,
  departmentFilter,
  onRefresh,
  onLoadingChange,
  onViewDetail,
  onReservation,
  onOpenUse: _onOpenUse,
  onOpenCheckIn: _onOpenCheckIn,
  onOpenCheckOut: _onOpenCheckOut,
  onOpenBorrow,
}) => {
  const getCurrentUserName = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.username || '系统操作员';
      }
      return localStorage.getItem('username') || '系统操作员';
    } catch {
      return '系统操作员';
    }
  };
  const { message: messageApi, modal } = App.useApp();
  const [settings] = useSystemSettings();
  const { isMobile } = useResponsive();
  
  // 标准物质入库容量模态框状态
  const [capacityModalVisible, setCapacityModalVisible] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(null);
  const [capacityForm] = Form.useForm();
  const [fetchingDetail, setFetchingDetail] = useState(false);
  const [fetchedCapacity, setFetchedCapacity] = useState<{initial: number, current: number, unit: string} | null>(null);

  // 计算容量选项
  const baseCapacity = useMemo(() => {
    return getInstrumentCapacityBase(currentInstrument, fetchedCapacity);
  }, [currentInstrument, fetchedCapacity]);

  const unit = fetchedCapacity?.unit || (currentInstrument as any)?.unit || '';

  const capacityOptions = useMemo(() => buildCapacityOptions(baseCapacity, unit), [baseCapacity, unit]);

  const {
    instruments,
    loading,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    total,
    fetchInstruments,
    applyOptimisticUpdate,
    instrumentsRef
  } = useInstrumentTableData({
    searchQuery,
    flowStatusFilter,
    typeFilter,
    departmentFilter,
    onRefresh,
    onLoadingChange
  });

  // 使用仪器操作hooks
  const { handleCheckOut, handleCheckIn, handleClearLatestRecord, handleUse } = useInstrumentActions({ onRefresh: () => fetchInstruments(true) });

  // 处理出库操作 - 创建适配函数
  const handleCheckOutClick = useCallback(async (instrumentId: string) => {
    const inst = instrumentsRef.current.find(instr => instr.id === instrumentId);
    const blockedMessage = getBlockedFlowActionMessage(inst);
    if (blockedMessage) {
      messageApi.warning(blockedMessage);
      return;
    }
    
    modal.confirm({
      title: '确认出库',
      content: `确定要将仪器 "${inst?.name || instrumentId}" 出库吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const res = await handleCheckOut(
          instrumentId, 
          getCurrentUserName()
        );
        if (res) {
          applyOptimisticUpdate('checkout', instrumentId);
        }
      }
    });
  }, [handleCheckOut, applyOptimisticUpdate, messageApi, instrumentsRef, modal]);

  // 处理入库操作 - 创建适配函数
  const handleCheckInClick = useCallback(async (instrumentId: string) => {
    const inst = instrumentsRef.current.find(instr => instr.id === instrumentId);
    if (!inst) return;
    const blockedMessage = getBlockedFlowActionMessage(inst);
    if (blockedMessage) {
      messageApi.warning(blockedMessage);
      return;
    }

    // 如果是标准物质，打开容量输入模态框
    if (isMaterialInstrument(inst)) {
      setCurrentInstrument(inst);
      setCapacityModalVisible(true);
      setFetchingDetail(true);
      setFetchedCapacity(null);

      // 异步获取最新详情
      apiClient.get(`/instruments/${inst.id}`)
        .then(res => {
          const data = res.data;
          if (data) {
            setFetchedCapacity({
              initial: Number(data.initialCapacity || 0),
              current: Number(data.currentCapacity || 0),
              unit: data.unit || ''
            });
          }
        })
        .catch(err => console.error(err))
        .finally(() => setFetchingDetail(false));

      capacityForm.setFieldsValue({ capacityValue: (inst as any).currentCapacity });
      return;
    }
    
    modal.confirm({
      title: '确认入库',
      content: `确定要将仪器 "${inst?.name || instrumentId}" 入库吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const res = await handleCheckIn(
          instrumentId, 
          getCurrentUserName(), 
          inst?.location
        );
        if (res) {
          applyOptimisticUpdate('checkin', instrumentId);
        }
      }
    });
  }, [handleCheckIn, applyOptimisticUpdate, messageApi, instrumentsRef, modal, capacityForm]);

  // 处理标准物质入库确认
  const handleCapacitySubmit = async () => {
    try {
      const values = await capacityForm.validateFields();
      if (!currentInstrument) return;

      const res = await handleCheckIn(
        currentInstrument.id,
        getCurrentUserName(),
        currentInstrument.location,
        undefined, // condition
        undefined, // usageTime
        undefined, // notes
        values.capacityPercent, // capacityPercent
        values.capacityValue, // capacityValue
        values.isConsumed // isConsumed
      );

      if (res) {
        applyOptimisticUpdate('checkin', currentInstrument.id);
        setCapacityModalVisible(false);
        messageApi.success('入库成功');
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  // 处理使用操作
  const handleUseClick = useCallback(async (instrumentId: string) => {
    const inst = instrumentsRef.current.find(instr => instr.id === instrumentId);
    const blockedMessage = getBlockedFlowActionMessage(inst);
    if (blockedMessage) {
      messageApi.warning(blockedMessage);
      return;
    }
    const res = await handleUse(instrumentId, '使用', undefined, '（使用）');
    if (res) {
      applyOptimisticUpdate('use', instrumentId);
    }
  }, [handleUse, applyOptimisticUpdate, messageApi, instrumentsRef]);

  // 处理预约操作
  const handleReservationClick = useCallback((instrumentId: string) => {
    const inst = instrumentsRef.current.find(i => i.id === instrumentId);
    const blockedMessage = getBlockedFlowActionMessage(inst);
    if (blockedMessage) {
      messageApi.warning(blockedMessage);
      return;
    }
    if (inst && onReservation) {
      onReservation(inst);
    }
  }, [onReservation, messageApi, instrumentsRef]);

  // 处理借用操作
  const handleBorrowClick = useCallback((instrumentId: string) => {
    const inst = instrumentsRef.current.find(i => i.id === instrumentId);
    const blockedMessage = getBlockedFlowActionMessage(inst);
    if (blockedMessage) {
      messageApi.warning(blockedMessage);
      return;
    }
    if (inst && onOpenBorrow) {
      onOpenBorrow(inst);
    }
  }, [onOpenBorrow, messageApi, instrumentsRef]);

  // 处理清除记录操作 - 创建适配函数
  const handleClearRecordClick = useCallback(async (instrumentId: string) => {
    const ok = await handleClearLatestRecord(instrumentId, true);
    if (ok) {
      applyOptimisticUpdate('clear', instrumentId);
    }
  }, [handleClearLatestRecord, applyOptimisticUpdate]);

  // 获取表格列配置并转换为DataTable需要的格式
  const getColumns = useCallback((): InstrumentTableColumn[] => {
    // 调用原始的TableColumns函数获取列配置
    const originalColumns = TableColumns({
      onCheckOut: handleCheckOutClick,
      onCheckIn: handleCheckInClick,
      onUse: handleUseClick,
      onBorrow: handleBorrowClick,
      onClearRecord: handleClearRecordClick,
      onDetail: (id) => {
        const inst = instrumentsRef.current.find(i => i.id === id);
        if (inst && onViewDetail) {
          onViewDetail(inst);
        }
      },
      onReservation: handleReservationClick,
      settings // 传递settings
    });
    
    // 转换为DataTable需要的格式
    return originalColumns.map(col => ({
      key: col.key,
      title: col.title,
      width: col.width,
      ellipsis: col.ellipsis,
      dataIndex: col.dataIndex || col.key,
      render: col.render,
      resizable: col.resizable !== false,
      draggable: col.draggable !== false,
      sorter: ['name', 'model', 'serialNumber', 'managementNumber', 'type'].includes(col.key)
    }));
  }, [handleCheckOutClick, handleCheckInClick, handleUseClick, handleBorrowClick, handleClearRecordClick, onViewDetail, onReservation, settings, instrumentsRef]);

  const memoColumns = useMemo(() => getColumns(), [getColumns]);

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorMessage}>
          加载错误: {error}
        </div>
      )}
      
      <>
        {isMobile ? (
          <div className={styles.cardList}>
            {instruments.map(inst => (
              <InstrumentCard
                key={inst.id}
                data={inst}
                onCheckOut={handleCheckOutClick}
                onCheckIn={handleCheckInClick}
                onUse={handleUseClick}
                onBorrow={handleBorrowClick}
                onClearRecord={handleClearRecordClick}
                onDetail={(id) => {
                  const inst = instrumentsRef.current.find(i => i.id === id);
                  if (inst && onViewDetail) {
                    onViewDetail(inst);
                  }
                }}
                onReservation={handleReservationClick}
              />
            ))}
            {instruments.length === 0 && !loading && (
              <div className={styles.emptyState}>暂无数据</div>
            )}
          </div>
        ) : (
          <DataTable
            dataSource={instruments}
            columns={memoColumns}
            rowKey="id"
            loading={loading}
            pagination={false} // 禁用内置分页
            tableId="instrument-flow-table"
          />
        )}
        
        {/* 使用公共分页组件 */}
        <div className={styles.paginationWrapper}>
          <div className={styles.paginationComponent}>
            <Pagination
              total={total}
              pageSize={pageSize}
              current={currentPage}
              onChange={(page, size) => {
                setCurrentPage(page);
                if (size) {
                  setPageSize(size);
                  setCurrentPage(1); // 切换页大小时重置到第一页
                }
              }}
              showSizeChanger={true}
              pageSizeOptions={[10, 20, 50, 100]}
              showTotal={true}
            />
          </div>
        </div>
      </>
      
      <Modal
        title="标准物质入库 - 更新容量"
        open={capacityModalVisible}
        onOk={handleCapacitySubmit}
        okText="确定"
        cancelText="取消"
        onCancel={() => setCapacityModalVisible(false)}
        afterClose={() => {
            capacityForm.resetFields();
            setFetchedCapacity(null);
        }}
      >
        <Spin spinning={fetchingDetail}>
        <Form form={capacityForm} layout="vertical">
          <Form.Item name="capacityPercent" label="快捷选择"> 
            <Select placeholder="请选择当前容量" onChange={(val) => {
              if (val === 100) {
                 capacityForm.setFieldsValue({ isConsumed: false });
                 // Set capacityValue to baseCapacity so it gets recorded in flow_records
                 if (baseCapacity) {
                    capacityForm.setFieldsValue({ capacityValue: baseCapacity });
                 }
              } else if (val === 0) {
                 capacityForm.setFieldsValue({ isConsumed: true, capacityValue: 0 });
              } else {
                capacityForm.setFieldsValue({ isConsumed: false });
                if (baseCapacity) {
                  const valNum = Number(val);
                  const calculated = Number((baseCapacity * valNum / 100).toFixed(2));
                  capacityForm.setFieldsValue({ capacityValue: calculated });
                }
              }
            }}>
              {capacityOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>{opt.text}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="capacityValue"
            label={`当前容量${unit ? `（单位：${unit}）` : ''}`}
            rules={[{ required: false, message: '请输入当前容量' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              placeholder="请输入剩余容量" 
              onChange={() => capacityForm.setFieldsValue({ isConsumed: false })}
            />
          </Form.Item>

          <Form.Item name="isConsumed" valuePropName="checked">
            <Checkbox onChange={(e) => {
              if (e.target.checked) {
                capacityForm.setFieldsValue({ capacityPercent: 0, capacityValue: 0 });
              }
            }}>
              已使用完（标记为已使用）
            </Checkbox>
          </Form.Item>
        </Form>
        </Spin>
      </Modal>
    </div>
  );
};

export default InstrumentListTable;
