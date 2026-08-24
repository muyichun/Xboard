# 部署与发布

应用代码和 Composer 依赖全部构建进镜像，容器本身不可变。Compose 只挂载运行配置和持久化数据。

**镜像只在构建机上构建，导出成 tar 包传到生产机导入。生产机不构建、不需要源码依赖、
不需要 submodule。** 这样两台机器跑的一定是同一个镜像，不会因为构建环境不同而出现
「本机好好的，线上不对」。

两台机器共用**同一份 `compose.yaml`**，差异只体现在各自的 `.env` 里。

## 两台机器的分工

| | 构建机（兼开发机） | 生产机 |
|---|---|---|
| 机器位置 | 阿里云（国内） | 海外 |
| 职责 | 改代码、构建镜像、导出镜像包 | 只导入镜像并运行 |
| `XBOARD_BIND_IP` | `0.0.0.0` | `127.0.0.1` |
| 对外入口 | 公网 IP 直连 `http://<IP>:7001` | nginx 反代 → `127.0.0.1:7001` |
| `APP_URL` | `http://<公网IP>:7001` | `https://<域名>` |
| 需要 submodule | 是（构建要用） | 否 |
| 需要 buildx | 是 | 否 |
| 发布命令 | `make release` | `make deploy FILE=...` |

`.env` 和 `.docker/.data/database.sqlite` 两台机器各自独立，**任何时候都不要互相覆盖**。

生产机上那份 git 仓库只是为了拿到 `compose.yaml`、`Makefile`、`scripts/`——应用代码走镜像。
所以**只有改动了这几个编排文件时，生产机才需要 `git pull`**，日常发布不用动它。

## 挂载的持久化内容

重建容器、换镜像都不会动这些：

- `.env` —— 运行配置
- `.docker/.data/` —— SQLite 数据库和备份
- `storage/logs/`、`storage/theme/`
- `plugins/`
- `redis-data` named volume

其余（缓存、临时文件、`public/theme`、vendor）都由镜像重新生成，不需要迁移。

## 环境依赖

两台机器都需要 Docker（含 compose 插件）和 make：

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

生产机不构建，`docker-buildx-plugin` 可以不装。海外机器把源换回官方即可。

建议两边都配置容器日志轮转，否则 supervisor 打到 stdout 的日志会无限增长：

```jsonc
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

### 只有构建机需要的

**Docker Hub 镜像源**。构建机在国内，拉基础镜像必须配，否则构建卡住；
`registry-mirrors` 只对 docker.io 生效。写进同一个 `daemon.json` 后 `systemctl restart docker`：

```jsonc
"registry-mirrors": [
  "https://docker.m.daocloud.io",
  "https://docker.1ms.run"
]
```

生产机不拉任何远端镜像（镜像是 tar 包传过去的），这段不需要。

**子模块** `public/assets/admin`（管理端静态资源）来自 GitHub，clone 不下来时可临时挂代理：

```bash
git -c http.proxy=http://127.0.0.1:7890 submodule update --init --recursive
```

`Dockerfile` 会硬校验 `public/assets/admin/manifest.json`，子模块没拉全会直接构建失败。
生产机不构建，不需要这个子模块。

构建期容器内的 apk 和 composer 默认走阿里云源（`Dockerfile` 里的 build arg），
镜像站没同步到当前 alpine 版本时会自动回退官方 CDN。

## 首次部署

### 构建机

```bash
git clone --recurse-submodules -b muyichun https://github.com/muyichun/Xboard.git
cd Xboard
mkdir -p .docker/.data storage/logs storage/theme plugins

cp .env.example .env
# 编辑 .env：APP_URL 填公网地址，XBOARD_BIND_IP=0.0.0.0

make build
make install      # 生成 APP_KEY、建表、输出管理员账号密码，记下来
make recreate
```

### 生产机

```bash
# 不用 --recurse-submodules，生产机不构建
git clone -b muyichun https://github.com/muyichun/Xboard.git
cd Xboard
mkdir -p .docker/.data storage/logs storage/theme plugins dist

cp .env.example .env
# 编辑 .env：APP_URL 填域名，XBOARD_BIND_IP=127.0.0.1

# 把构建机导出的镜像包传过来（见下一节），然后：
make load FILE=dist/xboard.tar.gz
make install      # 全新实例才执行；从旧实例迁移则跳过
make recreate
```

从已有实例迁移时跳过 `make install`，直接把旧机器的 `.env` 和
`.docker/.data/database.sqlite`（按需再加 `plugins/`、`storage/theme/`）拷过来，再 `make recreate`。

## 日常发布

**构建机**：

```bash
make release
```

`make release` 依次完成：构建镜像 → 在本机重建容器并等健康检查通过 →
导出镜像包到 `dist/xboard.tar.gz`（固定文件名，每次覆盖）。

顺序是刻意的：**本机跑不起来就导不出包**（`--wait` 健康检查不过直接中断），
所以传到生产机的镜像至少是验证过能启动的。

**生产机**——收到镜像包后：

```bash
make deploy FILE=dist/xboard.tar.gz
```

依次完成：导入镜像 → 重建容器并等健康检查 → 清理被顶替的旧镜像。
数据库迁移由容器 entrypoint 在启动时自动执行（`php artisan xboard:update`），不用手动跑。

改了 `compose.yaml` / `Makefile` / `scripts/` 时，生产机需要先 `git pull` 再 deploy。

## 把镜像包传到生产机

镜像约 568MB，gzip 后约 **122MB**，导出耗时十几秒。每次发布都是重新打的完整镜像，
增量同步意义不大，直接 scp：

```bash
# 构建机上
scp dist/xboard.tar.gz 生产机:/root/Xboard/dist/
```

两台机器之间不通、需要经本地电脑中转时，就正常下载再上传，文件本身没有特殊要求。

## 升级基础镜像

`Dockerfile` 里的两个基础镜像按 digest 钉死，`--pull` 不会再自动跟上游走。这样同一个提交
永远构建出同一个底座，不会因为几个月后 tag 指向变了而构建出不同的东西。想升级时手动取新 digest：

```bash
docker pull phpswoole/swoole:php8.2-alpine
docker image inspect phpswoole/swoole:php8.2-alpine --format '{{index .RepoDigests 0}}'
```

**在能直连 Docker Hub 的机器上取**——国内经镜像源拿到的 digest 和官方不是同一个。
拿到后替换 `Dockerfile` 第一段的 `@sha256:...`，提交，再 `make release`。
基础镜像一变会触发全量重建，约 5-8 分钟，导出的包也是完整的 122MB。

## 备份

`make release` / `make deploy` 不再自动备份，靠定时 cron（保留最近 7 份），发布前有需要就手动 `make backup`：

```bash
crontab -e
# 30 4 * * * /root/Xboard/scripts/backup-sqlite.sh >> /var/log/xboard-backup.log 2>&1
```

恢复：

```bash
make down
cp .docker/.data/backups/daily_database_<时间戳>.sqlite .docker/.data/database.sqlite
make recreate
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

## 构建机走 Cloudflare 域名（可选）

CF 的 HTTP 代理不支持 7001 端口。要用域名访问，二选一：

1. **DNS-only（灰云）**：A 记录指向公网 IP，访问 `http://<域名>:7001`，端口保留在 URL 里；
2. **改用可代理端口**：把 `.env` 的 `XBOARD_PORT` 改成 CF 支持的 `8080` 或 `2052`，开橙云代理。

需要 HTTPS 和干净的 URL 时，在构建机上也照生产机的方式装 nginx 反代，
并把 `XBOARD_BIND_IP` 改回 `127.0.0.1`。

## 常用命令

```bash
make help       # 全部命令
make ps         # 容器状态
make logs       # 跟踪日志
make shell      # 进容器
make recreate   # 用现有镜像重建容器
make restart    # 只重启容器
make down       # 停止并移除容器（数据和镜像保留）
```
