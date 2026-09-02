import React from 'react';
import { Dropdown, Button, App } from 'antd';
import CheckOutButton from './CheckOutButton';
import CheckInButton from './CheckInButton';
import DetailButton from './DetailButton';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionGuard } from '../../../../../features/auth/components/PermissionGuard';
import styles from '../InstrumentFlowTable.module.css';

interface OperationButtonsProps {
  instrumentId: string;
  flowStatus: '在库中' | '已出库' | string;
  onCheckOut: (id: string) => void;
  onCheckIn: (id: string) => void;
  onUse: (id: string) => void;
  onBorrow: (id: string) => void;
  onDelete: (id: string) => void;
  onDetail: (id: string) => void;
  onReservation: (id: string) => void;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const OperationButtons: React.FC<OperationButtonsProps> = ({
  instrumentId,
  flowStatus,
  onCheckOut,
  onCheckIn,
  onUse,
  onBorrow,
  onDelete,
  onDetail,
  onReservation,
  size = 'middle',
  className
}) => {
  const { modal } = App.useApp();
  const { hasPermission } = usePermission();

  const buttonClass = `${styles.operationBtn} ${className || ''}`;

  // 创建下拉菜单（AntD v5 使用 menu.items）
  const menuItems = [];
  
  if (hasPermission('flow:borrow')) {
    menuItems.push({ 
      key: 'borrow', 
      label: '借用',
      disabled: flowStatus === '停用' || flowStatus === '已使用'
    });
  }

  if (hasPermission('flow:reserve')) {
    menuItems.push({ key: 'reservation', label: '预约' });
  }
  
  if (hasPermission('flow:delete')) {
    menuItems.push({ key: 'delete', label: '清除记录' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <PermissionGuard permission="flow:checkout">
          <CheckOutButton 
            instrumentId={instrumentId} 
            onClick={onCheckOut} 
            disabled={flowStatus !== '在库中'}
            size={size}
            className={buttonClass}
          />
        </PermissionGuard>
        <PermissionGuard permission="flow:checkin">
          <CheckInButton 
            instrumentId={instrumentId} 
            onClick={onCheckIn} 
            disabled={flowStatus !== '已出库'}
            size={size}
            className={buttonClass}
          />
        </PermissionGuard>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <DetailButton 
          instrumentId={instrumentId} 
          onClick={onDetail}
          size={size}
          className={buttonClass}
        />
        {menuItems.length > 0 && (
          <Dropdown 
            placement="bottomRight"
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === 'borrow') {
                  onBorrow(instrumentId);
                } else if (key === 'use') {
                  modal.confirm({
                    title: '是否确认已使用',
                    okText: '确认',
                    cancelText: '取消',
                    onOk: () => onUse(instrumentId)
                  });
                } else if (key === 'reservation') {
                  onReservation(instrumentId);
                } else if (key === 'delete') {
                   onDelete(instrumentId);
                }
              }
            }}
          >
            <Button size={size} className={buttonClass}>更多</Button>
          </Dropdown>
        )}
      </div>
    </div>
  );
};

export default OperationButtons;
