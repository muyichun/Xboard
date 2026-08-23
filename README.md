# Xboard

基于 Laravel 12 + Octane 的面板系统。本仓库 fork 自
[cedar2025/Xboard](https://github.com/cedar2025/Xboard)，现由本人自行维护，
部署方式已改为**本地源码构建镜像、导出后传到生产机运行**，不再使用上游的 ghcr 镜像和
宝塔/1Panel 安装脚本。

## 部署

**镜像只在构建机（国内那台）上构建一次，导出成 tar 包传到生产机导入；生产机不构建。**
两台机器共用同一份 `compose.yaml`，差异只在各自的 `.env`。完整流程见 **[deploy.md](./deploy.md)**。

构建机——改完提交后发布：

```bash
make release     # 备份 → 构建 → 本机起容器验证 → 导出 dist/xboard-<git短sha>.tar.gz
```

把镜像包传到生产机（约 122MB），在生产机上：

```bash
make deploy FILE=dist/xboard-<sha>.tar.gz   # 备份 → 导入 → 重建容器 → 清理旧镜像
```

```bash
make help                                   # 全部命令
make versions                               # 本机留存的镜像版本
make backup                                 # 立即备份 SQLite
make logs / ps / shell / down

# 回滚：历史镜像还在生产机上，直接切，不用重传也不用重新构建
XBOARD_TAG=<git短sha> make recreate
```

## 仓库结构

| 路径 | 说明 |
|---|---|
| `compose.yaml` | 唯一的编排文件，构建机与生产机通用 |
| `Dockerfile` | 单容器镜像：Octane + Horizon + Redis + ws-server + Caddy，由 supervisor 拉起 |
| `Makefile` | 构建、导出、导入、发布、回滚、备份入口 |
| `.env.example` | 配置模板，按机器复制成 `.env`（不入库） |
| `.docker/` | 容器内 Caddy / PHP / supervisor 配置，以及挂载出来的 SQLite 数据 |
| `dist/` | `make save` 导出的镜像 tar 包（不入库） |
| `scripts/backup-sqlite.sh` | SQLite 在线备份，保留最近 7 份 |
| `plugins/` | 运行时插件目录（挂载，不入镜像） |

## 技术栈

- 后端：Laravel 12 + Octane（Swoole）
- 管理端：React + Shadcn UI + TailwindCSS（`public/assets/admin` 子模块）
- 用户端：Vue3 + TypeScript + NaiveUI
- 队列/缓存：Redis + Horizon
- 部署：Docker 单容器 + Compose，构建机构建、生产机导入镜像运行

## 开发文档

- [插件开发指南](./docs/en/development/plugin-development-guide.md)
- [性能调优](./docs/en/development/performance.md)
- [设备数限制](./docs/en/development/device-limit.md)

## 预览

![Admin Preview](./docs/images/admin.png)

![User Preview](./docs/images/user.png)

## 许可

MIT，见 [LICENSE](./LICENSE)。原项目版权归 cedar2025 及其贡献者所有。

本项目仅供学习交流使用，使用者需自行承担相应责任。
