import React, { useEffect, useState } from 'react';
import { Modal, Button, Spin } from 'antd';
import type { ModalProps } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';
import { getInstrumentDetail } from '../../services/instrumentFlowService';

interface DetailModalProps extends ModalProps {
  instrument?: Instrument | null;
  onCheckOut?: (id: string) => void;
  onCheckIn?: (id: string) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({
  instrument,
  onCheckOut,
  onCheckIn,
  ...modalProps
}) => {
  const [dbData, setDbData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!instrument) {
        setDbData(null);
        return;
      }
      setLoading(true);
      try {
        const data = await getInstrumentDetail(instrument.id);
        setDbData(data || instrument);
      } catch {
        setDbData(instrument);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [instrument, modalProps.open]);

  return (
    <Modal
      {...modalProps}
      title={<div style={{ display: 'flex', alignItems: 'center' }}>
        <InfoCircleOutlined style={{ marginRight: 8, fontSize: 18 }} />
        仪器详情
      </div>}
      footer={instrument ? (
        <>
          {(((instrument as any).inOutStatus || (instrument as any).flowStatus || (instrument as any).flow_status) === '在库中') && onCheckOut && (
            <Button key="checkout" type="primary" onClick={() => onCheckOut(instrument.id)} style={{ marginRight: 8 }}>
              出库
            </Button>
          )}
          {(((instrument as any).inOutStatus || (instrument as any).flowStatus || (instrument as any).flow_status) === '已出库') && onCheckIn && (
            <Button key="checkin" type="default" onClick={() => onCheckIn(instrument.id)} style={{ marginRight: 8 }}>
              入库
            </Button>
          )}
          <Button key="close" onClick={modalProps.onCancel}>
            关闭
          </Button>
        </>
      ) : null}
      width={800}
    >
      {instrument ? (
        loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '10px' }}>
            <div style={{ marginBottom: 12, fontWeight: 600 }}>{dbData?.name || instrument.name}</div>
            {(() => {
              const src: any = dbData || instrument;
              const getVal = (paths: string[]): any => {
                for (const p of paths) {
                  const v = src[p];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return v;
                }
                return '';
              };
              const rows: Array<{ label: string; value: any }> = [
                { label: '仪器类型', value: getVal(['type']) },
                { label: '仪器名称', value: getVal(['name']) },
                { label: '型号规格', value: getVal(['model']) },
                { label: '所属合并组', value: getVal(['groupName']) },
                { label: '组型号规格', value: getVal(['groupModel']) },
                { label: '组测量范围', value: getVal(['groupMeasureRange']) },
                { label: '出厂编号', value: getVal(['serialNumber','factoryNumber','serial_number']) },
                { label: '管理编号', value: getVal(['managementNumber','management_number']) },
                { label: '启用日期', value: getVal(['enableDate']) },
                { label: '初始容量', value: (() => {
                  const val = getVal(['initialCapacity']);
                  const u = getVal(['unit']);
                  return (val !== undefined && val !== '') ? `${val}${u ? ` ${u}` : ''}` : '';
                })() },
                { label: '当前容量', value: (() => {
                  const val = getVal(['currentCapacity']);
                  const u = getVal(['unit']);
                  return (val !== undefined && val !== '') ? `${val}${u ? ` ${u}` : ''}` : '';
                })() },
                { label: '生产厂商', value: getVal(['manufacturer']) },
                { label: '测量范围', value: getVal(['measureRange','measurementRange','measurement_range']) },
                { label: '计量参数范围', value: getVal(['metrologicalParameterRange']) },
                { label: '测量不确定度/最大允许误差', value: getVal(['measurementUncertainty','uncertainty']) },
                { label: '溯源方式', value: getVal(['traceabilityMethod']) },
                { label: '校准日期', value: getVal(['calibrationDate','calibration_date']) },
                { label: '校准周期', value: getVal(['cycle','calibrationCycle']) },
                { label: '复校日期', value: getVal(['recalibrationDate','nextCalibrationDate','recalibration_date']) },
                { label: '证书编号', value: getVal(['traceabilityCertificate','certificateNumber']) },
                { label: '校准机构', value: getVal(['traceabilityAgency','calibrationInstitution']) },
                { label: '科室', value: getVal(['department']) },
                { label: '存放位置', value: getVal(['storageLocation','location']) },
                { label: '仪器状态', value: getVal(['instrumentStatus','status']) },
                { label: '出入库状态', value: getVal(['storageStatus','inOutStatus','flow_status']) },
                { label: '采购日期', value: getVal(['purchaseDate']) },
                { label: '验收日期', value: getVal(['acceptanceDate']) },
                { label: '采购负责人', value: getVal(['purchasePerson']) },
                { label: '预警设置', value: (() => {
                  const val = getVal(['alertLevel']);
                  if (!val) return '';
                  try {
                    const obj = typeof val === 'string' ? JSON.parse(val) : val;
                    const parts = [];
                    if (obj.time) parts.push(`时间: ${obj.time}天`);
                    if (obj.capacity) parts.push(`容量: ${obj.capacity}%`);
                    return parts.join(', ');
                  } catch {
                    return val;
                  }
                })() },
                { label: '操作人', value: getVal(['operator', 'lastOperator']) },
                { label: '备注', value: getVal(['remarks']) },
                { label: '附件', value: (() => {
                  const val = getVal(['attachment']);
                  if (!val) return '';
                  return typeof val === 'string' ? val : (val.name || '已上传');
                })() }
              ];
              return (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  {rows.map((r, idx) => (
                    <div key={idx} style={{ display: 'flex', marginBottom: 8, alignItems: 'center' }}>
                      <div style={{ width: 160, color: '#666' }}>{r.label}</div>
                      <div style={{ flex: 1, color: '#333' }}>{r.value ? <span className="copyable">{String(r.value)}</span> : '-'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          未找到仪器信息
        </div>
      )}
    </Modal>
  );
};

export default DetailModal;
