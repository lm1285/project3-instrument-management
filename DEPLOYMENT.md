# 阿里云 ECS 部署说明

本文档对应当前清理后的仓库结构，只覆盖仪器管理系统前后端、`bingxijing.py` 相关文件，以及阿里云服务器部署。

## Excel VSTO 模板服务

VSTO 加载项运行在每个用户自己的 Windows Excel 进程中，不能部署到 ECS 代替本地 Excel。部署后端时会自动迁移 `excel_templates` 表，为模板保存随机数配置、目录元数据、状态和版本信息。模板接口使用现有登录 Token 和 `system:template:*` 权限；加载项客户端地址应配置为 `https://wzglpt.top`。

影刀 Python 模块仍调用用户本机的 `http://127.0.0.1:30771/api/yingdao/generate`，由本机加载项写入当前 Excel。多人共享的是云端模板库和审计数据，不是同一个 Excel 会话。

## 1. 服务器建议

- 操作系统：Ubuntu 22.04 LTS 或 CentOS 7+
- Node.js：20.x
- npm：10.x 或随 Node.js 安装
- Python：3.10+
- 进程管理：PM2
- Web 服务：Nginx

建议部署目录：

```bash
/opt/instrument-management
```

## 2. 服务器初始化

```bash
sudo mkdir -p /opt/instrument-management
sudo chown -R $USER:$USER /opt/instrument-management

curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs python3 nginx

sudo npm install -g pm2
```

如果是 Ubuntu，可将安装命令替换为：

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip nginx
sudo npm install -g pm2
```

## 3. 上传项目

将当前清理后的整个仓库上传到服务器，例如：

```bash
scp -r ./project3-instrument-management user@your-server:/opt/instrument-management
```

上传后进入项目目录：

```bash
cd /opt/instrument-management/project3-instrument-management
```

## 4. 安装依赖

前端依赖：

```bash
npm install
```

后端依赖：

```bash
cd backend
npm install
cd ..
```

Python 说明：

- `backend/bingxijing.py` 本地测试无需额外三方包。
- 如果生产环境由外部自动化平台调用 `xbot`，则 `xbot` 由对应运行环境提供，不在本仓库内安装。

## 5. 构建前后端

前端构建：

```bash
npm run build:prod
```

后端构建：

```bash
cd backend
npm run build
cd ..
```

## 6. PM2 启动后端

后端目录已保留 `backend/ecosystem.config.js`，可直接启动：

```bash
cd /opt/instrument-management/project3-instrument-management/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

PM2 日志滚动（`deploy_server.sh` 会自动配置；手工部署时执行一次）:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 30
pm2 save
```

默认情况下后端只记录写请求、4xx/5xx 和耗时超过 1 秒的请求。短期排障可在 PM2 环境变量中设置 `LOG_ALL_REQUESTS=true`，结束后立即关闭；可用 `SLOW_REQUEST_MS` 调整慢请求阈值，`AUDIT_RETENTION_DAYS` 调整审计日志保留天数（默认 180 天）。

系统设置 -> 操作日志页面提供“下载诊断包”。下载前填入错误响应中的 `X-Request-ID`，服务端会按该 ID 提取应用日志和审计记录；诊断包默认最多读取 8MB 应用日志，硬上限 20MB，并且仅授予 `system:audit:export` 权限的管理员/用户使用。

常用命令：

```bash
pm2 status
pm2 logs instrument-management-backend --lines 100
pm2 restart instrument-management-backend
```

如果 PM2 进程名与配置文件中定义的不一致，请先执行：

```bash
pm2 list
```

## 7. Nginx 反向代理

仓库保留了部署配置目录：

- `deploy/nginx/`
- `deploy/systemd/`
- `deploy/scripts/`

可根据域名或 IP 方式选择 Nginx 模板。示例流程：

```bash
sudo cp deploy/nginx/wzglpt_ip.conf /etc/nginx/conf.d/instrument-management.conf
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

`bootstrap.sh` 会安装 Nginx 的 14 天/20MB 滚动规则和 systemd journal 的 500MB/14 天上限。若不使用 `bootstrap.sh`，请手工复制 `deploy/logrotate/wzglpt-nginx` 至 `/etc/logrotate.d/`，并复制 `deploy/journald/30-wzglpt-retention.conf` 至 `/etc/systemd/journald.conf.d/` 后重启 `systemd-journald`。

如需 HTTPS，可改用 `deploy/nginx/https_nginx.conf` 或 `deploy/nginx/wzglpt_ssl.conf`。

## 8. 数据与目录说明

保留目录：

- `backend/data/`：运行数据
- `templates_to_process/`：模板分析输入/输出目录
- `backend/public/excel-addin/`：Excel 插件静态资源

部署时不要删除这些目录。

建议定期备份：

```bash
cp -r backend/data backend/data.backup.$(date +%Y%m%d_%H%M%S)
cp -r templates_to_process templates_to_process.backup.$(date +%Y%m%d_%H%M%S)
```

## 9. 验证

后端健康检查：

```bash
curl http://127.0.0.1:3002/health
```

前端静态文件构建结果：

```bash
ls -la dist
```

Python 业务脚本自测：

```bash
python backend/test_bingxijing.py
```

## 10. 清理说明

本仓库已移除以下非交付内容：

- `node_modules/`、`dist/`、Python 虚拟环境、缓存目录
- 历史部署压缩包与拆分脚本
- 与阿里云部署无关的平台配置
- 无关实验脚本、空文件、临时文档、重复备份目录

如果后续需要重新安装依赖，只需重新执行 `npm install` 即可。
