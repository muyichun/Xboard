# 本地源码构建部署

应用代码和 Composer 依赖全部构建进镜像。Compose 只挂载运行配置和持久化数据，更新代码后通过重建镜像、重建容器发布。

## 迁移内容

必选：

1. `.env`
2. `.docker/.data/database.sqlite`

按实际使用情况迁移：

- `plugins/`
- `storage/theme/`

Redis、缓存、日志、临时文件和 `public/theme` 不需要从旧实例迁移。

## 首次部署

```bash
git clone --recurse-submodules \
  -b muyichun \
  https://github.com/muyichun/Xboard.git

cd Xboard
mkdir -p .docker/.data storage/logs storage/theme plugins

docker compose build --pull
docker compose up -d --force-recreate --remove-orphans
```

## 发布新代码

```bash
cd Xboard
git pull --ff-only
git submodule sync --recursive
git submodule update --init --recursive

docker compose build --pull
docker compose up -d --force-recreate --remove-orphans
docker image prune -f
```

重建容器不会删除 `.docker/.data`、`storage/logs`、`storage/theme`、`plugins` 或 Redis named volume。
