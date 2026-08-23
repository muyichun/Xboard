SHELL := /bin/bash

COMPOSE := docker compose
IMAGE   := xboard
# 保留多少个历史版本镜像可供回滚。
KEEP_IMAGES := 5
# 本次构建的版本号：git 短 sha，用于回滚定位。
TAG     := $(shell git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M)

.PHONY: up deploy build recreate tag down restart ps logs shell backup \
        rollback images prune install help

help:
	@echo "make up        构建新镜像并发布（开发机、生产机同一条命令）"
	@echo "make down      停止并移除容器（数据与镜像保留）"
	@echo "make restart   不重建镜像，只重启容器"
	@echo "make logs      跟踪容器日志"
	@echo "make ps        查看容器状态"
	@echo "make shell     进入容器"
	@echo "make backup    立即备份 SQLite"
	@echo "make images    列出可回滚的历史镜像"
	@echo "make rollback VERSION=<sha>   回滚到指定镜像版本"
	@echo "make install   首次安装（仅新实例执行一次）"

# ---------------------------------------------------------------------------
# 发布：备份 → 重建镜像 → 打版本标签 → 重建容器（等待健康）→ 清理旧镜像。
# 任一步失败即中断，不会留下半成品状态。
# ---------------------------------------------------------------------------
up: backup build tag recreate prune
	@echo "发布完成：$(IMAGE):$(TAG)"

deploy: up

build:
	$(COMPOSE) build --pull

# 给刚构建出的镜像打上版本标签，make rollback 才有目标可选。
tag:
	@docker image tag $(IMAGE):latest $(IMAGE):$(TAG)

recreate:
	$(COMPOSE) up -d --force-recreate --remove-orphans --wait

down:
	$(COMPOSE) down --remove-orphans

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

shell:
	$(COMPOSE) exec xboard sh

# 容器在跑且数据库存在时才备份，否则跳过（首次部署、纯构建场景）。
backup:
	@if [[ -s .docker/.data/database.sqlite ]] && \
		$(COMPOSE) ps --status running --services 2>/dev/null | grep -qx xboard; then \
		./scripts/backup-sqlite.sh; \
	else \
		echo "跳过 SQLite 备份（数据库不存在或容器未运行）。"; \
	fi

images:
	@docker image ls $(IMAGE) --format 'table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}'

# 回滚镜像版本，不动数据库。数据结构有变更时需自行从备份恢复 SQLite。
rollback:
	@[[ -n "$(VERSION)" ]] || { echo "用法：make rollback VERSION=<sha>，可选版本见 make images" >&2; exit 1; }
	@docker image inspect $(IMAGE):$(VERSION) >/dev/null
	docker image tag $(IMAGE):$(VERSION) $(IMAGE):latest
	$(COMPOSE) up -d --force-recreate --wait
	@echo "已回滚到 $(IMAGE):$(VERSION)"

# 只清理本项目被取代的悬空镜像，保留 BuildKit 缓存和其它项目的镜像；
# 再把版本标签收敛到最近 KEEP_IMAGES 个，避免 sha 标签无限堆积。
# 正在运行的版本同时挂着 latest 标签，删 sha 标签不会真正删掉它。
prune:
	@docker image prune -f --filter "label=com.xboard.local-image=true"
	@docker image ls $(IMAGE) --format '{{.CreatedAt}}\t{{.Tag}}' \
		| grep -vP '\tlatest$$' | sort -r | tail -n +$$(($(KEEP_IMAGES) + 1)) \
		| cut -f2 | xargs -r -I{} docker image rm $(IMAGE):{} >/dev/null 2>&1 || true

# 首次安装：容器还没跑起来时用一次性容器执行，装完再 make up。
install:
	$(COMPOSE) run --rm \
		-e ENABLE_SQLITE=true \
		-e ENABLE_REDIS=true \
		xboard php artisan xboard:install
