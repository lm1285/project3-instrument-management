import { Button, Card, Typography } from 'antd';
import type { StepProps } from 'antd';
import {
  CheckCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export type MaintenanceTarget = 'frontend' | 'backend' | 'database';

export interface MaintenanceResultItem {
  success: boolean;
  msg: string;
}

interface CreateMaintenanceCardsOptions {
  loadingMap: Record<string, boolean>;
  runSingleMaintenance: (type: MaintenanceTarget) => Promise<void>;
}

export function createMaintenanceCards({ loadingMap, runSingleMaintenance }: CreateMaintenanceCardsOptions) {
  return [
    {
      key: 'frontend',
      span: { xs: 24, md: 8 },
      cardProps: {
        hoverable: true,
        style: { height: '100%', background: '#fafafa', border: 'none' },
        actions: [
          <Button type="link" onClick={() => void runSingleMaintenance('frontend')} loading={loadingMap.frontend} key="frontend-action">
            立即优化
          </Button>,
        ],
      },
      meta: {
        avatar: <GlobalOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
        title: '页面与前端',
        description: (
          <div style={{ marginTop: 8 }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              优化浏览器渲染性能，清理本地无效缓存，提升页面响应速度。
            </Paragraph>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                包含：LocalStorage 清理，资源重载
              </Text>
            </div>
          </div>
        ),
      },
    },
    {
      key: 'backend',
      span: { xs: 24, md: 8 },
      cardProps: {
        hoverable: true,
        style: { height: '100%', background: '#fafafa', border: 'none' },
        actions: [
          <Button type="link" onClick={() => void runSingleMaintenance('backend')} loading={loadingMap.backend} key="backend-action">
            立即优化
          </Button>,
        ],
      },
      meta: {
        avatar: <CloudServerOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
        title: '后端服务',
        description: (
          <div style={{ marginTop: 8 }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              清理服务器临时文件，轮转过期日志，释放磁盘空间与内存。
            </Paragraph>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                包含：Temp 文件清理，日志归档
              </Text>
            </div>
          </div>
        ),
      },
    },
    {
      key: 'database',
      span: { xs: 24, md: 8 },
      cardProps: {
        hoverable: true,
        style: { height: '100%', background: '#fafafa', border: 'none' },
        actions: [
          <Button type="link" onClick={() => void runSingleMaintenance('database')} loading={loadingMap.database} key="database-action">
            立即优化
          </Button>,
        ],
      },
      meta: {
        avatar: <DatabaseOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
        title: '数据库',
        description: (
          <div style={{ marginTop: 8 }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              重建索引，压缩存储空间，检查数据完整性，确保查询高效。
            </Paragraph>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                包含：VACUUM，ANALYZE，完整性检查
              </Text>
            </div>
          </div>
        ),
      },
    },
  ];
}

interface CreateMaintenanceStepsOptions {
  currentStep: number;
  loading: boolean;
  results: MaintenanceResultItem[];
}

export function createMaintenanceSteps({ currentStep, loading, results }: CreateMaintenanceStepsOptions): StepProps[] {
  return [
    {
      title: '前端性能优化',
      description: currentStep === 0 && loading ? '正在清理浏览器缓存...' : results[0]?.msg || '等待执行',
      icon:
        currentStep === 0 && loading ? (
          <LoadingOutlined />
        ) : currentStep > 0 && results[0]?.success ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <GlobalOutlined />
        ),
      status: currentStep === 0 && loading ? 'process' : currentStep > 0 ? (results[0]?.success ? 'finish' : 'error') : 'wait',
    },
    {
      title: '后端服务维护',
      description: currentStep === 1 && loading ? '正在清理临时文件与日志...' : results[1]?.msg || '等待执行',
      icon:
        currentStep === 1 && loading ? (
          <LoadingOutlined />
        ) : currentStep > 1 && results[1]?.success ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <CloudServerOutlined />
        ),
      status: currentStep === 1 && loading ? 'process' : currentStep > 1 ? (results[1]?.success ? 'finish' : 'error') : 'wait',
    },
    {
      title: '数据库深度优化',
      description: currentStep === 2 && loading ? '正在执行 VACUUM 和完整性检查...' : results[2]?.msg || '等待执行',
      icon:
        currentStep === 2 && loading ? (
          <LoadingOutlined />
        ) : currentStep > 2 && results[2]?.success ? (
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
        ) : (
          <DatabaseOutlined />
        ),
      status: currentStep === 2 && loading ? 'process' : currentStep > 2 ? (results[2]?.success ? 'finish' : 'error') : 'wait',
    },
    {
      title: '维护完成',
      description: !loading && currentStep === 3 ? '所有系统组件已优化至最佳状态' : '等待所有任务完成',
      icon: currentStep === 3 ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined,
      status: currentStep === 3 ? 'finish' : 'wait',
    },
  ];
}

export function renderMaintenanceCard(card: ReturnType<typeof createMaintenanceCards>[number]) {
  return (
    <Card {...card.cardProps}>
      <Card.Meta {...card.meta} />
    </Card>
  );
}
