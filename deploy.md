# 部署与发布

应用代码和 Composer 依赖全部构建进镜像，容器本身不可变。Compose 只挂载运行配置和持久化数据，
发布一律走「重建镜像 → 重建容器」，不做热更新。

开发机和生产机用**同一份 `compose.yaml`**，差异只体现在各自的 `.env` 里。

| | 开发机 | 生产机 |
|---|---|---|
| `XBOARD_BIND_IP` | `0.0.0.0` | `127.0.0.1` |
| 对外入口 | 公网 IP 直连 `http://<IP>:7001` | nginx 反代 → `127.0.0.1:7001` |
| `APP_URL` | `http://<公网IP>:7001` | `https://<域名>` |
| 机器位置 | 阿里云（国内） | 海外 |
| 构建源 | 默认阿里云，不用改 | `.env` 里放开 `ALPINE_MIRROR=` / `COMPOSER_MIRROR=` 走官方源 |
| Docker 镜像源 | `registry-mirrors` 必配 | 不需要 |
| 发布命令 | `make up` | `make up` |

`.env` 和 `.docker/.data/database.sqlite` 两台机器各自独立，**任何时候都不要互相覆盖**。

## 挂载的持久化内容

重建镜像和容器都不会动这些：

- `.env` —— 运行配置
- `.docker/.data/` —— SQLite 数据库和备份
- `storage/logs/`、`storage/theme/`
- `plugins/`
- `redis-data` named volume

其余（缓存、临时文件、`public/theme`、vendor）都由镜像重新生成，不需要迁移。

## 环境依赖

宿主机只需要 Docker（含 compose / buildx 插件）和 make：

```bash
# Debian 13 为例，国内机器用阿里云源
install -m 0755 -d /etc/apt/keyrings
curl -fsSL http://mirrors.cloud.aliyuncs.com/docker-ce/linux/debian/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
http://mirrors.cloud.aliyuncs.com/docker-ce/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

建议同时配置容器日志轮转，否则 supervisor 打到 stdout 的日志会无限增长：

```jsonc
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

**国内机器**（本项目的开发机）还要给 Docker Hub 配镜像源，否则拉不到基础镜像；
`registry-mirrors` 只对 docker.io 生效，海外机器不需要这一段。
写进同一个 `daemon.json` 后 `systemctl restart docker`：

```jsonc
"registry-mirrors": [
  "https://docker.m.daocloud.io",
  "https://docker.1ms.run"
]
```

构建期容器内的 apk 和 composer 默认走阿里云源（`Dockerfile` 里的 build arg），
镜像站没同步到当前 alpine 版本时会自动回退官方 CDN。

**生产机在海外**，把 `.env` 里这两行的注释放开即可回到官方源 —— 保持空值，不要填内容：

```dotenv
ALPINE_MIRROR=
COMPOSER_MIRROR=
```

忘了改不会导致失败，只是从海外拉阿里云源会慢一些。

子模块 `public/assets/admin`（管理端静态资源）来自 GitHub，clone 不下来时可临时挂代理：

```bash
git -c http.proxy=http://127.0.0.1:7890 submodule update --init --recursive
```

`Dockerfile` 会硬校验 `public/assets/admin/manifest.json`，子模块没拉全会直接构建失败。

## 首次部署

```bash
git clone --recurse-submodules -b muyichun https://github.com/muyichun/Xboard.git
cd Xboard
mkdir -p .docker/.data storage/logs storage/theme plugins

cp .env.example .env
# 按上表编辑 .env：APP_URL、XBOARD_BIND_IP

make build
make install      # 生成 APP_KEY、建表、输出管理员账号密码，记下来
make up
```

若是从已有实例迁移，跳过 `make install`，直接把旧机器的 `.env` 和
`.docker/.data/database.sqlite`（按需再加 `plugins/`、`storage/theme/`）拷过来，然后 `make up`。

## 日常发布

```bash
cd Xboard
git pull --ff-only
git submodule update --init --recursive

make up
```

`make up` 会依次完成：备份 SQLite → `build --pull` 重建镜像 → 用 git 短 sha 打版本标签 →
`--force-recreate --wait` 重建容器并等待健康检查通过 → 清理被取代的旧镜像。
中间任何一步失败都会立即中断。

## 升级基础镜像

`Dockerfile` 里的两个基础镜像按 digest 钉死，`--pull` 不会再自动跟上游走。这是刻意的：
国内镜像源和 Docker Hub 对同一个 tag 会返回不同的镜像，不钉死开发机和生产机就会
构建在不同基础上。想升级时手动取新 digest：

```bash
docker pull phpswoole/swoole:php8.2-alpine
docker image inspect phpswoole/swoole:php8.2-alpine --format '{{index .RepoDigests 0}}'
```

**在能直连 Docker Hub 的机器上取**（比如海外的生产机）。国内机器经镜像源拿到的 digest
和官方不是同一个，取回来会把两台机器又拆开。拿到后替换 `Dockerfile` 第一段的
`@sha256:...`，提交，再 `make up`。基础镜像一变会触发全量重建，约 5-8 分钟。

## 回滚

镜像不单独维护版本，只有 `latest` 一个标签——回滚就是回滚代码，重新构建：

```bash
git log --oneline               # 找到要回退到的提交
git checkout <commit>           # 或 git revert，看你的分支习惯
make up                         # 照常构建、发布
```

回滚只换代码和镜像，不动数据库。如果这中间跑过破坏性的数据库迁移，还需要从备份恢复
SQLite。**发布前先提交代码**——`make up` 会在工作区有未提交改动时提醒你，这种发布出
问题会不好定位是哪个版本的内容。

## 备份

`make up` 每次发布前会自动备份一次。日常定时备份加一条 cron（保留最近 7 份）：

```bash
crontab -e
# 30 4 * * * /root/Xboard/scripts/backup-sqlite.sh >> /var/log/xboard-backup.log 2>&1
```

恢复：

```bash
make down
cp .docker/.data/backups/daily_database_<时间戳>.sqlite .docker/.data/database.sqlite
make up
```

## 生产机 nginx 反代

容器内的 Caddy 已经把 HTTP 和 `/ws` WebSocket 合并到 7001 单端口，nginx 只需一个 upstream：

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:7001;
        proxy_http_version 1.1;

        # /ws 的 WebSocket 升级依赖这两个头
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300s;
    }
}
```

`$connection_upgrade` 需要在 `http` 段定义一次：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

真实客户端 IP 由 `app/Http/Middleware/TrustProxies.php` 解析，其中已包含内网网段和
Cloudflare 网段，走 nginx 或套 CF 都不需要额外改动。

## 开发机走 Cloudflare 域名（可选）

CF 的 HTTP 代理不支持 7001 端口。要用域名访问，二选一：

1. **DNS-only（灰云）**：A 记录指向公网 IP，访问 `http://<域名>:7001`，端口保留在 URL 里；
2. **改用可代理端口**：把 `.env` 的 `XBOARD_PORT` 改成 CF 支持的 `8080` 或 `2052`，开橙云代理。

需要 HTTPS 和干净的 URL 时，在开发机上也照生产机的方式装 nginx 反代，
并把 `XBOARD_BIND_IP` 改回 `127.0.0.1`。

## 常用命令

```bash
make help      # 全部命令
make ps        # 容器状态
make logs      # 跟踪日志
make shell     # 进容器
make restart   # 只重启容器，不重建镜像
make down      # 停止并移除容器（数据和镜像保留）
```
