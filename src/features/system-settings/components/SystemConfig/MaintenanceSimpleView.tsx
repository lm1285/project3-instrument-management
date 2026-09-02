import React from 'react';
import { Button, Col, Divider, Modal, Result, Row, Steps, Typography } from 'antd';
import { 
    RocketOutlined, 
    SettingOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { useSystemVersion } from '../../../../hooks/useSystemVersion';
import dayjs from 'dayjs';
import { renderMaintenanceCard } from './maintenanceSimpleViewConfig';
import { useMaintenanceSimpleView } from '../../hooks/useMaintenanceSimpleView';

const { Text } = Typography;

const MaintenanceSimpleView: React.FC<{ onSwitchToAdvanced: () => void }> = ({ onSwitchToAdvanced }) => {
  const versionInfo = useSystemVersion();
  const { loading, modalVisible, setModalVisible, maintenanceCards, maintenanceSteps, runAllMaintenance } = useMaintenanceSimpleView();

  return (
    <div style={{ padding: '0 20px 20px' }}>
       {/* Main Dashboard */}
       <Result
          icon={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
          title="系统健康中心"
          subTitle={
            <div>
              全方位的系统维护与优化工具，保障系统长期稳定运行。
              {versionInfo && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    当前版本: v{versionInfo.version} <span style={{ margin: '0 8px' }}>|</span> 构建时间: {dayjs(versionInfo.buildTime).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </div>
              )}
            </div>
          }
          extra={[
            <Button type="primary" size="large" key="console" onClick={() => void runAllMaintenance()} loading={loading} icon={<RocketOutlined />}>
              一键全面优化
            </Button>,
            <Button key="advanced" onClick={onSwitchToAdvanced} icon={<SettingOutlined />}>
              高级参数配置
            </Button>,
          ]}
        />
        
        <Divider orientation="left">分项维护</Divider>

        <Row gutter={[24, 24]}>
          {maintenanceCards.map((card) => (
            <Col key={card.key} {...card.span}>
              {renderMaintenanceCard(card)}
            </Col>
          ))}
        </Row>

        <Modal
            title="正在执行全面系统维护"
            open={modalVisible}
            footer={!loading ? [<Button key="ok" type="primary" onClick={() => setModalVisible(false)}>完成</Button>] : null}
            closable={!loading}
            maskClosable={false}
            centered
            width={600}
        >
            <div style={{ padding: '20px 0' }}>
                <Steps
                    direction="vertical"
                    current={loading ? undefined : 3}
                    items={maintenanceSteps}
                />
            </div>
        </Modal>
    </div>
  );
};

export default MaintenanceSimpleView;
