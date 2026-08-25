SHELL := /bin/bash

COMPOSE := docker compose
IMAGE_ARCHIVE := dist/xboard.tar.gz
FILE ?= $(IMAGE_ARCHIVE)
MAX_BUILD_CACHE := 5GB

export BUILDX_NO_DEFAULT_ATTESTATIONS := 1

.PHONY: help release deploy install ps logs shell backup restart down
.NOTPARALLEL:

help:
	@echo "发布："
	@echo "  make release   开发机：构建、重建验证、导出 $(IMAGE_ARCHIVE)"
	@echo "  make deploy    生产机：备份、导入 $(FILE)、覆盖部署、健康检查"
	@echo "  make install   生产机：仅全新实例初始化，随后编辑 .env 并执行 make deploy"
	@echo
	@echo "运维：make ps / logs / shell / backup / restart / down"

release:
	@test -f .env || { echo "开发机缺少 .env，无法启动新镜像进行验证。" >&2; exit 1; }
	@grep -qE '^INSTALLED=(1|true)$$' .env || \
		{ echo "开发机尚未完成安装，无法启动新镜像进行验证。" >&2; exit 1; }
	$(COMPOSE) build --pull
	$(COMPOSE) up -d --force-recreate --remove-orphans --wait --no-build --pull never
	@ref="$$($(COMPOSE) config --images | head -n1)"; \
		tmp="$(IMAGE_ARCHIVE).tmp"; \
		trap 'rm -f "$$tmp"' EXIT; \
		docker save "$$ref" | gzip > "$$tmp"; \
		mv "$$tmp" "$(IMAGE_ARCHIVE)"; \
		trap - EXIT; \
		ls -lh "$(IMAGE_ARCHIVE)"
	@docker builder prune -f --max-used-space $(MAX_BUILD_CACHE) >/dev/null 2>&1 || true

deploy:
	@test -s "$(FILE)" || { echo "镜像包不存在或为空：$(FILE)" >&2; exit 1; }
	@$(MAKE) --no-print-directory backup
	docker load -i "$(FILE)"
	$(COMPOSE) up -d --force-recreate --remove-orphans --wait --no-build --pull never
	@docker image prune -f --filter "label=com.xboard.local-image=true"
	@ref="$$($(COMPOSE) config --images | head -n1)"; echo "已上线：$$ref"

install:
	@test -f .env || { echo "缺少 .env，请先执行 cp .env.example .env。" >&2; exit 1; }
	@test -s "$(FILE)" || { echo "镜像包不存在或为空：$(FILE)" >&2; exit 1; }
	@! grep -qE '^INSTALLED=(1|true)$$' .env || \
		{ echo "当前实例已安装，禁止再次执行 make install。" >&2; exit 1; }
	@test ! -s .docker/.data/database.sqlite || \
		{ echo "检测到非空 SQLite；迁机请直接执行 make deploy。" >&2; exit 1; }
	docker load -i "$(FILE)"
	$(COMPOSE) run --rm --pull never \
		-e ENABLE_SQLITE=true \
		-e ENABLE_REDIS=true \
		xboard php artisan xboard:install
	@grep -qE '^INSTALLED=(1|true)$$' .env || \
		{ echo "安装未完成，请检查上方日志。" >&2; exit 1; }
	@echo "初始化完成：保存管理员信息，编辑 .env，然后执行 make deploy。"

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

shell:
	$(COMPOSE) exec xboard sh

backup:
	@if [[ -s .docker/.data/database.sqlite ]] && \
		$(COMPOSE) ps --status running --services 2>/dev/null | grep -qx xboard; then \
		./scripts/backup-sqlite.sh; \
	else \
		echo "跳过 SQLite 备份（数据库不存在或容器未运行）。"; \
	fi

restart:
	$(COMPOSE) restart

down:
	$(COMPOSE) down --remove-orphans
