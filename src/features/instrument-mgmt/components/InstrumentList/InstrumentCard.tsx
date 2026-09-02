import React from 'react';
import { Tag, Button, Space } from 'antd';
import { EditOutlined, DeleteOutlined, EllipsisOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Instrument } from '../../types';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';

interface InstrumentCardProps {
  data: Instrument;
  onEdit: (instrument: Instrument) => void;
  onDelete: (id: string) => void;
  onHistory: (instrument: Instrument) => void;
}

const CardContainer = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const CardTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

const CardSubtitle = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const StatusTag = styled(Tag)`
  font-size: 12px;
`;

const InfoRow = styled.div`
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
`;

const InfoLabel = styled.span`
  width: 100px;
  color: #888;
  margin-right: 8px;
  flex-shrink: 0;
`;

const InfoValue = styled.span`
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardFooter = styled.div`
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MiniButton = styled(Button)`
  font-size: 12px;
  padding: 4px 8px;
`;

const InstrumentCard: React.FC<InstrumentCardProps> = ({
  data,
  onEdit,
  onDelete,
  onHistory
}) => {
  const getStatusColor = (status: string) => {
    if (!status) return 'default';
    if (status === '使用中') return 'green';
    if (status === '停用') return 'red';
    if (status === '待校准') return 'orange';
    if (status === '已报废') return 'default';
    return 'blue';
  };

  const handleMenuClick = (key: string) => {
    switch (key) {
      case 'history':
        onHistory(data);
        break;
      default:
        break;
    }
  };

  return (
    <CardContainer>
      <CardHeader>
        <div>
          <CardTitle>{data.name}</CardTitle>
          <CardSubtitle>{data.model || '-'}</CardSubtitle>
        </div>
        <StatusTag color={getStatusColor(data.status || '')}>
          {data.status || '未知状态'}
        </StatusTag>
      </CardHeader>
      
      <div>
        <InfoRow>
          <InfoLabel>管理编号:</InfoLabel>
          <InfoValue>{data.managementNumber || '-'}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>出厂编号:</InfoLabel>
          <InfoValue>{data.serialNumber || '-'}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>溯源证书:</InfoLabel>
          <InfoValue>{data.certificateNumber || '-'}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>测量范围:</InfoLabel>
          <InfoValue dangerouslySetInnerHTML={{ __html: data.measureRange || '-' }} />
        </InfoRow>
        <InfoRow>
          <InfoLabel>当前状态:</InfoLabel>
          <InfoValue>{data.status || '-'}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>科室:</InfoLabel>
          <InfoValue>{data.department || '-'}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoLabel>存放位置:</InfoLabel>
          <InfoValue>{data.location || '-'}</InfoValue>
        </InfoRow>
      </div>

      <CardFooter>
        <Space size="small">
          <MiniButton
            icon={<EditOutlined />}
            onClick={() => onEdit(data)}
            title="编辑"
          />
          <PermissionGuard permission="instrument:delete">
            <MiniButton
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(data.id!)}
              title="删除"
            />
          </PermissionGuard>
          <MiniButton
            icon={<EllipsisOutlined />}
            onClick={() => handleMenuClick('history')}
            title="历史记录"
          />
        </Space>
      </CardFooter>
    </CardContainer>
  );
};

export default InstrumentCard;