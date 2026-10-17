# Xboard

基于 Laravel 12 + Octane 的面板，fork 自 [cedar2025/Xboard](https://github.com/cedar2025/Xboard)。
维护分支：`muyichun`，不自动同步 upstream。

## 日常发布

开发机（需已完成初始化并可正常运行）：

```bash
cd /root/Xboard
git submodule update --init --recursive
make release
scp dist/xboard.tar.gz root\@47.245.52.43:/root/Xboard/dist/
```

生产机：

```bash
ssh root@47.245.52.43
cd /root/Xboard
make deploy
```

`make release` 构建镜像、重建开发容器并验证后导出；`make deploy` 备份、导入镜像、重建容器并检查健康状态。
生产机只导入镜像。若 `compose.yaml`、`Makefile` 或 `scripts/` 有更新，部署前先在生产机执行 `git pull --ff-only`。

## 安装与迁移

全新实例：准备仓库和镜像包后，执行 `cp .env.example .env` → `make install` → 编辑 `.env` → `make deploy`。

迁移旧实例：放好旧 `.env` 和 SQLite 数据，保留 `APP_KEY`、确认 `INSTALLED=1`，直接 `make deploy`，不要执行 `make install`。
详细步骤及恢复方法见 [deploy.md](deploy.md)。

## 常用命令

```bash
make ps       # 状态
make logs     # 日志
make shell    # 进入容器
make backup   # 在线备份 SQLite
make restart  # 重启
make down     # 停止
```

节点独立发布，见 [Xboard-Node 升级说明](https://github.com/muyichun/Xboard-Node/blob/muyichun/docs-maintenance.md)。
开发约定见 [AGENTS.md](AGENTS.md)，插件开发见 [插件指南](docs/en/development/plugin-development-guide.md)。
许可：[MIT](LICENSE)。
