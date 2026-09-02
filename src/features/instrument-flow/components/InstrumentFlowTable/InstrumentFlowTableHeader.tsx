import React from 'react';
import { ToolOutlined } from '@ant-design/icons';
import ModuleHeader from '../../../../components/UI/ModuleHeader';

const InstrumentFlowTableHeader: React.FC = () => {
  return (
    <ModuleHeader
      title="仪器出入"
      icon={<ToolOutlined />}
      eyebrow="Instrument Flow"
      subtitle="统一查看仪器出库、入库、借用、归还和预约流转状态。"
      meta={['现场流转管理', '扫码检索与状态筛选']}
    />
  );
};

export default InstrumentFlowTableHeader;
