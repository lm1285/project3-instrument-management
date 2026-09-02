# 两台电脑同步开发规范

本项目与 Excel 加载项保持独立 Git 仓库。两台电脑都从 GitHub 的 `main` 分支获取代码；电脑时间不同步不会影响 Git 的提交顺序，提交历史以父子关系和提交哈希为准。

## 第一次使用另一台电脑

```powershell
git clone https://github.com/lm1285/project3-instrument-management.git
cd project3-instrument-management
git switch main
npm install
cd backend
npm install
```

不要复制 `.git`、`node_modules`、`dist`、`backend/data`、`backend/logs` 或上传目录。`.env` 和部署密钥只在对应电脑配置，不提交到仓库。

## 每次开始开发

确保当前没有未保存的修改，然后执行：

```powershell
git switch main
git pull --ff-only origin main
```

如需同时开发多个功能，从最新 `main` 建立功能分支：

```powershell
git switch -c feat/简短功能名
```

## 每次结束开发

```powershell
git status
git add <实际修改的文件>
git commit -m "说明本次完成的功能"
git push -u origin <当前分支>
```

如果只使用 `main`，最后一条命令可以改为 `git push origin main`。提交后再切换电脑，另一台电脑先执行本节“每次开始开发”。

## 出现冲突或无法快进

不要使用 `reset --hard` 覆盖工作。先保留修改并查看状态：

```powershell
git status
git stash push -u -m "临时保存"
git pull --rebase origin main
git stash pop
```

解决冲突后执行 `git add`、`git rebase --continue`，通过测试后再 push。已经 push 的提交不要改写历史。

## 两个项目如何联动

运行时联动通过管理系统的 API 完成：Excel 加载项访问 `/api/excel-templates`，影刀通过 `/api/shadow-knife-linkage` 回传任务状态。模板、账号和业务数据由后端数据库保存，不通过 Git 同步。

因此两个仓库应分别提交、分别 push；不要把 Excel 加载项仓库嵌套到本仓库，也不要为了“同步进度”合并成一个仓库。需要联调时，先分别更新两个仓库，再按 `DEPLOYMENT.md` 部署管理系统。
