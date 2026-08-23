# Xboard

基于 Laravel 12 + Octane 的面板系统。本仓库 fork 自
[cedar2025/Xboard](https://github.com/cedar2025/Xboard)，现由本人自行维护，
部署方式已改为**本地源码构建镜像**，不再使用上游的 ghcr 镜像和宝塔/1Panel 安装脚本。

## 部署

开发机和生产机共用同一份 `compose.yaml`，差异只在各自的 `.env`。完整流程见 **[deploy.md](./deploy.md)**。

```bash
git pull --ff-only
git submodule update --init --recursive
make up          # 备份 → 重建镜像 → 重建容器 → 清理旧镜像
```

```bash
make help                      # 全部命令
make backup                    # 立即备份 SQLite
make logs / ps / shell / down

# 回滚：git 切到旧提交，重新构建，不单独维护镜像版本
git checkout <commit> && make up
```

## 仓库结构

| 路径 | 说明 |
|---|---|
| `compose.yaml` | 唯一的编排文件，开发机与生产机通用 |
| `Dockerfile` | 单容器镜像：Octane + Horizon + Redis + ws-server + Caddy，由 supervisor 拉起 |
| `Makefile` | 构建、发布、回滚、备份入口 |
| `.env.example` | 配置模板，按机器复制成 `.env`（不入库） |
| `.docker/` | 容器内 Caddy / PHP / supervisor 配置，以及挂载出来的 SQLite 数据 |
| `scripts/backup-sqlite.sh` | SQLite 在线备份，保留最近 7 份 |
| `plugins/` | 运行时插件目录（挂载，不入镜像） |

## 技术栈

- 后端：Laravel 12 + Octane（Swoole）
- 管理端：React + Shadcn UI + TailwindCSS（`public/assets/admin` 子模块）
- 用户端：Vue3 + TypeScript + NaiveUI
- 队列/缓存：Redis + Horizon
- 部署：Docker 单容器 + Compose

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
