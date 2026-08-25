# Xboard

基于 Laravel 12 + Octane 的面板系统。本仓库 fork 自
[cedar2025/Xboard](https://github.com/cedar2025/Xboard)，现由本人维护。

## 发布模型

开发机构建镜像，生产机只导入镜像。应用源码和 Composer 依赖都在镜像内；每次部署都会导入完整镜像、
强制重建容器并执行健康检查。`.env`、SQLite、日志、主题、插件和 Redis 数据独立持久化。

发布只需要记住三个命令：

```bash
make release   # 开发机：构建 → 重建验证 → 导出 dist/xboard.tar.gz
make deploy    # 生产机：备份 → 导入镜像 → 覆盖部署 → 健康检查 → 清理旧镜像
make install   # 生产机：仅全新实例执行一次初始化
```

## 三种场景

### 1. 全新安装

```bash
# 已有可运行 Xboard 的开发机
make release
scp dist/xboard.tar.gz <生产机>:/root/Xboard/dist/

# 生产机
cp .env.example .env
make install
# 编辑安装程序生成的 .env
make deploy
```

### 2. 使用旧数据在新生产机部署

在新机器放好旧 `.env`、`.docker/.data/database.sqlite` 和 `dist/xboard.tar.gz`，保留原
`APP_KEY` 并确认 `INSTALLED=1`：

```bash
make deploy
```

不要执行 `make install`。

### 3. 普通代码升级

```bash
# 开发机
git pull --ff-only
git submodule update --init --recursive
make release
scp dist/xboard.tar.gz <生产机>:/root/Xboard/dist/

# 生产机
make deploy
```

完整流程和 `make install` 说明见 [deploy.md](./deploy.md)。

## 运维命令

```bash
make ps
make logs
make shell
make backup
make restart
make down
```

## 技术栈

- 后端：Laravel 12 + Octane（Swoole）
- 管理端：React + Shadcn UI + TailwindCSS
- 用户端：Vue 3 + TypeScript + NaiveUI
- 队列与缓存：Redis + Horizon
- 容器：Octane + Horizon + Redis + WebSocket + Caddy，由 Supervisor 管理

## 开发文档

- [插件开发指南](./docs/en/development/plugin-development-guide.md)
- [性能调优](./docs/en/development/performance.md)
- [设备数限制](./docs/en/development/device-limit.md)

## 许可

MIT，见 [LICENSE](./LICENSE)。本项目仅供学习交流使用。
