import React, { useMemo } from 'react';
import {
  Card,
  Col,
  Form,
  List,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import { useSystemSettings } from '../../../hooks/useSystemSettings';

const { Text } = Typography;

const MAIN_MENU_ORDER = [
  'dashboard',
  'schedule',
  'instrumentFlow',
  'instrumentMgmt',
  'statistics',
];

const STATISTICS_ORDER = ['instrumentStats', 'usageConsumption'];

const MODULE_LABELS: Record<string, { zh: string; en: string }> = {
  dashboard: { zh: '预警总览', en: 'Alert Overview' },
  schedule: { zh: '日程安排', en: 'Schedule' },
  instrumentFlow: { zh: '仪器出入库', en: 'Instrument Flow' },
  instrumentMgmt: { zh: '仪器管理', en: 'Instrument Management' },
  statistics: { zh: '数据统计', en: 'Statistics' },
  instrumentStats: { zh: '仪器统计', en: 'Instrument Statistics' },
  usageConsumption: { zh: '使用与消耗', en: 'Usage & Consumption' },
};

const TOP_FUNCTION_OPTIONS = [
  { value: 'check-in', zh: '仪器入库', en: 'Instrument Check-in' },
  { value: 'check-out', zh: '仪器出库', en: 'Instrument Check-out' },
  { value: 'alert-handle', zh: '预警处理', en: 'Alert Handling' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: '2026-04-18' },
  { value: 'DD/MM/YYYY', label: '18/04/2026' },
  { value: 'MM/DD/YYYY', label: '04/18/2026' },
  { value: 'YYYY年MM月DD日', label: '2026年04月18日' },
];

const TIME_FORMAT_OPTIONS = [
  { value: '24h', label: '24 小时制 (14:30)' },
  { value: '12h', label: '12 小时制 (02:30 PM)' },
];

function normalizeOrder(order: string[] | undefined, defaults: string[]) {
  const current = Array.isArray(order) ? order.filter((item) => defaults.includes(item)) : [];
  const missing = defaults.filter((item) => !current.includes(item));
  return [...current, ...missing];
}

const PersonalizationSettings: React.FC = () => {
  const [settings, setSettings] = useSystemSettings();
  const personalization = (settings.personalization || {}) as any;
  const workbench = personalization.workbench || {
    showHomeModule: true,
    shortcutSorting: [],
    topFunctions: [],
    dashboardLayout: {},
    moduleSorting: MAIN_MENU_ORDER,
    statisticsSorting: STATISTICS_ORDER,
  };
  const localization = settings.localization || {
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
  };
  const table = settings.table || {
    dateFormat: localization.dateFormat,
  };
  const isEnglish = localization.language === 'en-US';

  const t = (zh: string, en: string) => (isEnglish ? en : zh);

  const mainMenuList = useMemo(
    () => normalizeOrder(workbench.moduleSorting, MAIN_MENU_ORDER),
    [workbench.moduleSorting],
  );

  const statisticsList = useMemo(
    () => normalizeOrder(workbench.statisticsSorting, STATISTICS_ORDER),
    [workbench.statisticsSorting],
  );

  const updateWorkbench = (patch: Record<string, unknown>) => {
    setSettings({
      personalization: {
        ...personalization,
        workbench: {
          ...workbench,
          ...patch,
        },
      } as any,
    });
  };

  const updateLocalization = (patch: Record<string, unknown>) => {
    setSettings({
      localization: {
        ...localization,
        ...patch,
      },
      table: {
        ...table,
        dateFormat: String(patch.dateFormat ?? localization.dateFormat),
      },
    } as any);
  };

  const moveItem = (
    list: string[],
    index: number,
    direction: 'up' | 'down',
    key: 'moduleSorting' | 'statisticsSorting',
  ) => {
    const nextList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= nextList.length) {
      return;
    }

    [nextList[index], nextList[targetIndex]] = [nextList[targetIndex], nextList[index]];
    updateWorkbench({ [key]: nextList });
  };

  const renderOrderList = (
    title: string,
    description: string,
    list: string[],
    key: 'moduleSorting' | 'statisticsSorting',
  ) => (
    <Card
      type="inner"
      title={title}
      extra={<Text type="secondary">{description}</Text>}
      styles={{ body: { padding: 0 } }}
    >
      <List
        dataSource={list}
        renderItem={(item, index) => (
          <List.Item
            actions={[
              <a key="up" onClick={() => moveItem(list, index, 'up', key)}>
                <ArrowUpOutlined style={{ opacity: index === 0 ? 0.35 : 1, pointerEvents: index === 0 ? 'none' : 'auto' }} />
              </a>,
              <a key="down" onClick={() => moveItem(list, index, 'down', key)}>
                <ArrowDownOutlined style={{ opacity: index === list.length - 1 ? 0.35 : 1, pointerEvents: index === list.length - 1 ? 'none' : 'auto' }} />
              </a>,
            ]}
          >
            <Space>
              <HolderOutlined style={{ color: '#999' }} />
              <span>{isEnglish ? MODULE_LABELS[item]?.en : MODULE_LABELS[item]?.zh || item}</span>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );

  return (
    <div style={{ padding: '12px 0' }}>
      <Form layout="vertical">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              type="inner"
              title={<span><AppstoreOutlined /> {t('工作台自定义', 'Workbench Preferences')}</span>}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={10}>
                  <Form.Item
                    label={t('显示首页模块', 'Show Home Module')}
                    extra={t('关闭后，侧边栏不再显示首页入口。', 'Hide the home entry in the sidebar.')}
                  >
                    <Switch
                      checked={workbench.showHomeModule !== false}
                      onChange={(checked) => updateWorkbench({ showHomeModule: checked })}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={14}>
                  <Form.Item
                    label={t('常用功能置顶', 'Pinned Shortcuts')}
                    extra={t('保留高频入口，减少重复跳转。', 'Keep common actions easy to reach.')}
                  >
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder={t('选择需要置顶的功能', 'Select shortcuts to pin')}
                      value={workbench.topFunctions || []}
                      onChange={(value) => updateWorkbench({ topFunctions: value })}
                      options={TOP_FUNCTION_OPTIONS.map((item) => ({
                        value: item.value,
                        label: isEnglish ? item.en : item.zh,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} xl={14}>
                  {renderOrderList(
                    t('主菜单顺序', 'Main Menu Order'),
                    t('按使用频率调整侧边栏主菜单顺序。', 'Adjust the primary sidebar order.'),
                    mainMenuList,
                    'moduleSorting',
                  )}
                </Col>
                <Col xs={24} xl={10}>
                  {renderOrderList(
                    t('统计菜单顺序', 'Statistics Menu Order'),
                    t('统一数据统计子菜单展示顺序。', 'Set the statistics submenu order.'),
                    statisticsList,
                    'statisticsSorting',
                  )}
                </Col>
              </Row>
            </Card>
          </Col>

          <Col span={24}>
            <Card
              type="inner"
              title={<span><CalendarOutlined /> {t('日期与时间', 'Date & Time')}</span>}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Form.Item label={t('日期格式', 'Date Format')}>
                    <Select
                      value={localization.dateFormat || 'YYYY-MM-DD'}
                      onChange={(value) => updateLocalization({ dateFormat: value })}
                      options={DATE_FORMAT_OPTIONS}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label={t('时间格式', 'Time Format')}>
                    <Select
                      value={localization.timeFormat || '24h'}
                      onChange={(value) => updateLocalization({ timeFormat: value })}
                      options={TIME_FORMAT_OPTIONS}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label={t('时区', 'Timezone')}>
                    <Select
                      value={localization.timezone || 'Asia/Shanghai'}
                      onChange={(value) => updateLocalization({ timezone: value })}
                      options={[
                        { label: t('中国标准时间 (UTC+8)', 'China Standard Time (UTC+8)'), value: 'Asia/Shanghai' },
                        { label: t('美国东部时间 (UTC-5)', 'Eastern Time (UTC-5)'), value: 'America/New_York' },
                        { label: t('英国时间 (UTC+0)', 'London Time (UTC+0)'), value: 'Europe/London' },
                        { label: t('日本标准时间 (UTC+9)', 'Japan Standard Time (UTC+9)'), value: 'Asia/Tokyo' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default PersonalizationSettings;
