import { Alert, Button, Card, Form, Input, InputNumber, Select, Slider, Switch } from 'antd';
import { SystemMaintenanceSettings } from '../../../../types/common';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';

const { Option } = Select;

interface MaintenanceSectionProps {
  maintenance: SystemMaintenanceSettings;
  updateSettings: (section: keyof SystemMaintenanceSettings, key: string, value: any) => void;
}

interface CacheSectionProps extends MaintenanceSectionProps {
  onCleanCache: () => Promise<void>;
}

interface DatabaseSectionProps extends MaintenanceSectionProps {
  onAnalyzeIndex: () => Promise<void>;
}

export function CacheMaintenanceSection({ maintenance, updateSettings, onCleanCache }: CacheSectionProps) {
  return (
    <>
      <Card title="缓存基础配置" variant="borderless" className="mb-4">
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用系统缓存">
            <Switch checked={maintenance.cache.enableCache} onChange={(value) => updateSettings('cache', 'enableCache', value)} />
          </Form.Item>
          <Form.Item label="自动清理缓存">
            <Switch checked={maintenance.cache.autoClean} onChange={(value) => updateSettings('cache', 'autoClean', value)} />
          </Form.Item>
          {maintenance.cache.autoClean && (
            <Form.Item label="清理间隔（小时）">
              <InputNumber
                min={1}
                max={720}
                value={maintenance.cache.cleanInterval}
                onChange={(value) => updateSettings('cache', 'cleanInterval', value)}
              />
            </Form.Item>
          )}
          <Form.Item label="手动操作">
            <PermissionGuard permission="system:maintenance:clean_cache">
              <Button onClick={onCleanCache}>立即清理所有缓存</Button>
            </PermissionGuard>
          </Form.Item>
        </Form>
      </Card>

      <Card title="缓存预热设置" variant="borderless" className="mb-4" style={{ marginTop: 16 }}>
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用缓存预热">
            <Switch checked={maintenance.cache.enableWarming} onChange={(value) => updateSettings('cache', 'enableWarming', value)} />
          </Form.Item>
          <Form.Item label="预热策略">
            <Select
              mode="multiple"
              disabled={!maintenance.cache.enableWarming}
              value={maintenance.cache.warmingStrategies}
              onChange={(value) => updateSettings('cache', 'warmingStrategies', value)}
              placeholder="选择预热策略"
            >
              <Option value="frequent_data">高频数据</Option>
              <Option value="user_preference">用户偏好</Option>
              <Option value="dictionary">系统字典</Option>
            </Select>
          </Form.Item>
        </Form>
      </Card>

      <Card title="分布式缓存配置" variant="borderless" style={{ marginTop: 16 }}>
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用分布式缓存">
            <Switch checked={maintenance.cache.distributed.enabled} onChange={(value) => updateSettings('cache', 'distributed.enabled', value)} />
          </Form.Item>
          {maintenance.cache.distributed.enabled && (
            <>
              <Form.Item label="节点列表">
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="输入节点地址，例如：192.168.1.10:6379"
                  value={maintenance.cache.distributed.nodes}
                  onChange={(value) => updateSettings('cache', 'distributed.nodes', value)}
                />
              </Form.Item>
              <Form.Item label="负载均衡策略">
                <Select
                  value={maintenance.cache.distributed.strategy}
                  onChange={(value) => updateSettings('cache', 'distributed.strategy', value)}
                >
                  <Option value="hash">一致性哈希</Option>
                  <Option value="random">随机</Option>
                  <Option value="round-robin">轮询</Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Card>
    </>
  );
}

export function DatabaseMaintenanceSection({ maintenance, updateSettings, onAnalyzeIndex }: DatabaseSectionProps) {
  return (
    <>
      <Card title="连接池配置" variant="borderless">
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="最小连接数">
            <InputNumber
              min={1}
              value={maintenance.database.connectionPool.minSize}
              onChange={(value) => updateSettings('database', 'connectionPool.minSize', value)}
            />
          </Form.Item>
          <Form.Item label="最大连接数">
            <InputNumber
              min={1}
              value={maintenance.database.connectionPool.maxSize}
              onChange={(value) => updateSettings('database', 'connectionPool.maxSize', value)}
            />
          </Form.Item>
          <Form.Item label="空闲超时（ms）">
            <InputNumber
              min={1000}
              step={1000}
              value={maintenance.database.connectionPool.idleTimeout}
              onChange={(value) => updateSettings('database', 'connectionPool.idleTimeout', value)}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card title="慢查询日志" variant="borderless" style={{ marginTop: 16 }}>
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用慢查询日志">
            <Switch checked={maintenance.database.slowQuery.enabled} onChange={(value) => updateSettings('database', 'slowQuery.enabled', value)} />
          </Form.Item>
          <Form.Item label="阈值（ms）">
            <InputNumber
              min={10}
              disabled={!maintenance.database.slowQuery.enabled}
              value={maintenance.database.slowQuery.threshold}
              onChange={(value) => updateSettings('database', 'slowQuery.threshold', value)}
            />
          </Form.Item>
          <Form.Item label="日志文件路径">
            <Input
              disabled={!maintenance.database.slowQuery.enabled}
              value={maintenance.database.slowQuery.logFile}
              onChange={(event) => updateSettings('database', 'slowQuery.logFile', event.target.value)}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card title="索引优化" variant="borderless" style={{ marginTop: 16 }}>
        <Alert message="索引优化建议基于最近 7 天的查询模式生成" type="info" showIcon style={{ marginBottom: 16 }} />
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="自动分析索引">
            <Switch
              checked={maintenance.database.indexOptimization.autoAnalyze}
              onChange={(value) => updateSettings('database', 'indexOptimization.autoAnalyze', value)}
            />
          </Form.Item>
          <Form.Item label="启用优化建议">
            <Switch
              checked={maintenance.database.indexOptimization.recommendations}
              onChange={(value) => updateSettings('database', 'indexOptimization.recommendations', value)}
            />
          </Form.Item>
          <Form.Item label="手动操作">
            <PermissionGuard permission="system:maintenance:analyze_index">
              <Button onClick={onAnalyzeIndex}>立即分析索引</Button>
            </PermissionGuard>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}

export function OptimizationMaintenanceSection({ maintenance, updateSettings }: MaintenanceSectionProps) {
  return (
    <>
      <Card title="图片压缩设置" variant="borderless">
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用上传压缩">
            <Switch
              checked={maintenance.optimization.imageCompression.enabled}
              onChange={(value) => updateSettings('optimization', 'imageCompression.enabled', value)}
            />
          </Form.Item>
          <Form.Item label="压缩质量">
            <Slider
              min={1}
              max={100}
              disabled={!maintenance.optimization.imageCompression.enabled}
              value={maintenance.optimization.imageCompression.quality}
              onChange={(value) => updateSettings('optimization', 'imageCompression.quality', value)}
            />
          </Form.Item>
          <Form.Item label="目标格式">
            <Select
              disabled={!maintenance.optimization.imageCompression.enabled}
              value={maintenance.optimization.imageCompression.format}
              onChange={(value) => updateSettings('optimization', 'imageCompression.format', value)}
            >
              <Option value="original">保持原格式</Option>
              <Option value="webp">WebP</Option>
              <Option value="jpeg">JPEG</Option>
            </Select>
          </Form.Item>
        </Form>
      </Card>

      <Card title="静态资源 CDN" variant="borderless" style={{ marginTop: 16 }}>
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="启用 CDN 加速">
            <Switch checked={maintenance.optimization.cdn.enabled} onChange={(value) => updateSettings('optimization', 'cdn.enabled', value)} />
          </Form.Item>
          <Form.Item label="CDN 域名">
            <Input
              disabled={!maintenance.optimization.cdn.enabled}
              placeholder="https://cdn.example.com"
              value={maintenance.optimization.cdn.domain}
              onChange={(event) => updateSettings('optimization', 'cdn.domain', event.target.value)}
            />
          </Form.Item>
          <Form.Item label="启用版本控制">
            <Switch
              disabled={!maintenance.optimization.cdn.enabled}
              checked={maintenance.optimization.cdn.versionControl}
              onChange={(value) => updateSettings('optimization', 'cdn.versionControl', value)}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card title="页面加载优化" variant="borderless" style={{ marginTop: 16 }}>
        <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="图片懒加载">
            <Switch checked={maintenance.optimization.pageLoad.lazyLoad} onChange={(value) => updateSettings('optimization', 'pageLoad.lazyLoad', value)} />
          </Form.Item>
          <Form.Item label="资源预加载（Prefetch）">
            <Switch checked={maintenance.optimization.pageLoad.prefetch} onChange={(value) => updateSettings('optimization', 'pageLoad.prefetch', value)} />
          </Form.Item>
          <Form.Item label="代码压缩">
            <Switch checked={maintenance.optimization.pageLoad.minify} onChange={(value) => updateSettings('optimization', 'pageLoad.minify', value)} />
          </Form.Item>
        </Form>
      </Card>
    </>
  );
}
