# 部署与发布

## 约定

- 开发机执行 `make release`，产出 `dist/xboard.tar.gz`。
- 生产机执行 `make deploy`，不构建、不拉取镜像、不挂载应用源码。
- 生产数据位于 `.env`、`.docker/.data/`、`storage/theme/`、`plugins/` 和 Redis volume。
- `dist/` 及其他空目录已提交占位文件，无需执行目录初始化命令。

开发机必须拉取管理端子模块：

```bash
git submodule update --init --recursive
```

## 三个 Make 命令

### `make release`

仅在开发机执行：

```text
构建镜像 → 用新镜像重建开发环境 → 健康检查 → 导出完整镜像包
```

健康检查失败时命令中止，不会导出新的镜像包。

### `make deploy`

仅在生产机执行，默认读取 `dist/xboard.tar.gz`：

```text
在线备份 SQLite → 导入完整镜像 → 强制重建容器 → 健康检查 → 清理旧镜像
```

重建使用 `--no-build --pull never`。生产机不会因为镜像缺失而本地构建或远程拉取。

### `make install`

只用于全新实例，默认从 `dist/xboard.tar.gz` 导入镜像，然后执行一次 `xboard:install`。它会生成：

- `APP_KEY`；
- SQLite 数据库；
- 管理员账号、密码和后台路径。

安装程序会按 `.env.example` 重写 `.env`，因此应在安装结束后修改 `APP_URL`、端口绑定、邮件等配置，
再执行 `make deploy` 启动正式容器。

检测到 `INSTALLED=1` 或非空 SQLite 时，`make install` 会直接拒绝执行。迁机和升级永远不要运行它。

## 方式一：全新安装

在已有可运行 Xboard 的开发机上：

```bash
cd /root/Xboard
git pull --ff-only
git submodule update --init --recursive
make release
```

生产机先准备仓库：

```bash
git clone -b muyichun https://github.com/muyichun/Xboard.git /root/Xboard
cd /root/Xboard
cp .env.example .env
```

开发机传输镜像：

```bash
scp dist/xboard.tar.gz <生产机>:/root/Xboard/dist/
```

生产机初始化并部署：

```bash
make install
# 保存管理员信息，然后编辑 .env
make deploy
```

生产机常用配置：

```dotenv
APP_URL=https://example.com
XBOARD_BIND_IP=127.0.0.1
XBOARD_PORT=7001
INSTALLED=1
```

## 方式二：使用旧数据在新生产机部署

如果旧实例仍在运行，先执行 `make backup`，不要直接复制正在写入的 SQLite。

在新生产机 clone 仓库，然后放置：

```text
/root/Xboard/.env
/root/Xboard/.docker/.data/database.sqlite
/root/Xboard/dist/xboard.tar.gz
```

确认旧 `APP_KEY` 没有变化且 `INSTALLED=1`，然后：

```bash
make deploy
```

不要执行 `make install`。容器启动时会自动执行 `xboard:update` 升级数据库。按需迁移 `plugins/` 和
`storage/theme/`。

## 方式三：普通代码升级

开发机：

```bash
cd /root/Xboard
git pull --ff-only
git submodule update --init --recursive
make release
scp dist/xboard.tar.gz <生产机>:/root/Xboard/dist/
```

生产机：

```bash
cd /root/Xboard
make deploy
```

只有 `compose.yaml`、`Makefile` 或 `scripts/` 发生变化时，生产机才需要先执行 `git pull --ff-only`。

## 检查与恢复

```bash
make ps
docker compose logs --tail=200
curl -fsS -o /dev/null \
  http://127.0.0.1:7001/api/v1/guest/comm/config \
  && echo "Xboard 正常"
```

SQLite 在线备份保存在 `.docker/.data/backups/`，默认保留最近 7 份。恢复：

```bash
make down
cp .docker/.data/backups/<备份文件>.sqlite .docker/.data/database.sqlite
make deploy
```
