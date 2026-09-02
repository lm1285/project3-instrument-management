# 仪器管理系统项目说明

本仓库已完成一次面向交付的清理，当前只保留以下内容：

- 仪器管理系统前端源码：`src/`、`public/`
- 仪器管理系统后端源码：`backend/src/`
- Excel 相关业务脚本：`backend/bingxijing.py`
- 模板分析与处理所需目录：`templates_to_process/`、`backend/scripts/`、`backend/public/excel-addin/`
- 依赖清单：根目录与 `backend/` 下的 `package.json`、`package-lock.json`
- 阿里云部署文件：`deploy/`、`DEPLOYMENT.md`、`backend/ecosystem.config.js`

已删除的内容主要包括：

- 本地缓存、虚拟环境、`node_modules/`、`dist/`、`__pycache__/`
- 历史压缩包、拆分部署脚本、临时启动脚本、无关实验文件
- 与当前阿里云部署无关的 Vercel 配置
- 与本次保留范围无关的独立脚本和备份目录

## 目录结构

```text
project3-instrument-management/
├─ src/                        前端源码
├─ public/                     前端静态资源
├─ backend/
│  ├─ src/                     后端源码
│  ├─ scripts/                 模板/Excel辅助脚本
│  ├─ public/excel-addin/      Excel 插件静态资源
│  ├─ data/                    运行数据
│  ├─ bingxijing.py            保留的 Python 业务脚本
│  ├─ test_bingxijing.py       bingxijing.py 自测脚本
│  ├─ package.json             后端依赖
│  └─ ecosystem.config.js      PM2 配置
├─ deploy/                     阿里云部署配置
├─ templates_to_process/       模板处理中间目录
├─ package.json                前端依赖
└─ DEPLOYMENT.md               部署说明
```

## 本地开发

前端：

```bash
npm install
npm run dev
```

后端：

```bash
cd backend
npm install
npm run dev
```

`bingxijing.py` 本地自测：

```bash
python backend/test_bingxijing.py
```

说明：

- `bingxijing.py` 本地测试不依赖真实 `xbot` 运行时，测试脚本里已经做了模拟。
- 生产部署请以 [DEPLOYMENT.md](/D:/project3-instrument-management/DEPLOYMENT.md) 为准。
