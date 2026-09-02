import React from 'react';
import { InstrumentTableColumn } from '../../../../components/UI/InstrumentTableColumns';

// 渲染器接口
interface Renderers {
  renderStatus?: (status: string) => React.ReactNode;
  renderActionButtons?: (instrumentId: string) => React.ReactNode;
}

/**
 * 仪器管理模块专用操作列配置
 */

// 独立的操作列配置
export const INSTRUMENT_MGMT_ACTION_COLUMN: InstrumentTableColumn = {
  key: 'instrumentMgmtAction',
  title: '操作',
  width: 280, // 增加宽度以容纳三个按钮
  align: 'center',
  fixed: false // 确保操作列不固定，随表格一起滚动
};

// 获取包含操作列的完整配置，将操作列放在附件列之后
export const getColumnsWithMgmtAction = (columns: InstrumentTableColumn[], renderers?: Renderers): InstrumentTableColumn[] => {
  const columnsCopy = [...columns];
  
  // 创建操作列配置，包含渲染函数
  const actionColumn: InstrumentTableColumn = {
    ...INSTRUMENT_MGMT_ACTION_COLUMN,
    render: (_, record) => {
      if (renderers?.renderActionButtons && record?.id) {
        return renderers.renderActionButtons(record.id);
      }
      return null;
    }
  };
  
  // 找到附件列的位置
  const attachmentsIndex = columnsCopy.findIndex(col => col.key === 'attachments');
  
  if (attachmentsIndex >= 0) {
    // 在附件列后插入操作列
    columnsCopy.splice(attachmentsIndex + 1, 0, actionColumn);
  } else {
    // 如果没有找到附件列，就添加到最后
    columnsCopy.push(actionColumn);
  }
  
  return columnsCopy;
};

export default INSTRUMENT_MGMT_ACTION_COLUMN;