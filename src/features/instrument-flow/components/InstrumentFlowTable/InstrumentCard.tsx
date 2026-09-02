import React from 'react';
import { Tag } from 'antd';
import styles from './InstrumentFlowTable.module.css';
import OperationButtons from './buttons/OperationButtons';
import { Instrument } from '../../types';

interface InstrumentCardProps {
  data: Instrument;
  onCheckOut: (id: string) => void;
  onCheckIn: (id: string) => void;
  onUse: (id: string) => void;
  onBorrow: (id: string) => void;
  onClearRecord: (id: string) => void;
  onDetail: (id: string) => void;
  onReservation: (id: string) => void;
}

const InstrumentCard: React.FC<InstrumentCardProps> = ({
  data,
  onCheckOut,
  onCheckIn,
  onUse,
  onBorrow,
  onClearRecord,
  onDetail,
  onReservation
}) => {
  const getStatusColor = (status: string) => {
    if (!status) return 'default';
    if (status.includes('入库')) return 'success';
    if (status.includes('出库')) return 'warning';
    if (status.includes('使用')) return 'processing';
    return 'default';
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>{data.name}</div>
          <div className={styles.cardSubtitle}>{data.model}</div>
        </div>
        <div className={styles.cardStatus}>
          <Tag color={getStatusColor(data.inOutStatus)}>{data.inOutStatus || '未知状态'}</Tag>
        </div>
      </div>
      
      <div className={styles.cardBody}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>管理编号:</span>
          <span className={styles.infoValue}>{data.managementNumber || '-'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>出厂编号:</span>
          <span className={styles.infoValue}>{data.serialNumber || '-'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>测量范围:</span>
          <span className={styles.infoValue}>{data.measureRange || '-'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>备注:</span>
          <span className={styles.infoValue}>{data.notes || '-'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>出库时间:</span>
          <span className={styles.infoValue}>{data.checkoutTime ? data.checkoutTime.replace(/（.*?）$/, '').split(' ')[0] : '-'}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>入库/使用:</span>
          <span className={styles.infoValue}>{data.checkinOrUseTime ? data.checkinOrUseTime.replace(/（使用）$/, '').split(' ')[0] : '-'}</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <OperationButtons
          instrumentId={data.id}
          flowStatus={data.inOutStatus}
          onCheckOut={onCheckOut}
          onCheckIn={onCheckIn}
          onUse={onUse}
          onBorrow={onBorrow}
          onDelete={onClearRecord}
          onDetail={onDetail}
          onReservation={onReservation}
          className={styles.miniButton}
        />
      </div>
    </div>
  );
};

export default InstrumentCard;
