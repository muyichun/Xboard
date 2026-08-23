SHELL := /bin/bash

COMPOSE := docker compose
IMAGE   := xboard

# 关掉 BuildKit 默认的 provenance/SBOM 证明。不关的话，即使所有层都命中缓存，
# 每次构建仍会导出新的 attestation manifest，image ID 随之改变，上一个镜像平白
# 变悬空，等于每次都要多清理一次。
# 注意：compose.yaml 里的 `provenance: false` 字段实测无效（compose 解析了但不
# 会传给 buildx），只有这个环境变量管用。
export BUILDX_NO_DEFAULT_ATTESTATIONS := 1
# 构建缓存上限。缓存能让无改动重建从几分钟降到几十秒，所以不清空、只封顶。
MAX_BUILD_CACHE := 5GB

.PHONY: up deploy build recreate down restart ps logs shell backup prune install help

help:
	@echo "make up        构建新镜像并发布（开发机、生产机同一条命令）"
	@echo "make down      停止并移除容器（数据与镜像保留）"
	@echo "make restart   不重建镜像，只重启容器"
	@echo "make logs      跟踪容器日志"
	@echo "make ps        查看容器状态"
	@echo "make shell     进入容器"
	@echo "make backup    立即备份 SQLite"
	@echo "make install   首次安装（仅新实例执行一次）"
	@echo
	@echo "回滚：git checkout <上一个提交> && make up —— 代码回滚、重新构建，"
	@echo "不单独维护镜像版本标签。"

# ---------------------------------------------------------------------------
# 发布：备份 → 重建镜像 → 重建容器（等待健康）→ 清理旧镜像。
# 只维护 latest 一个标签。回滚就是 git 切到旧提交再 make up，不额外维护镜像
# 版本——镜像本来就是代码的派生物，版本历史交给 git 一份就够了。
# 任一步失败即中断，不会留下半成品状态。
# ---------------------------------------------------------------------------
up: backup build recreate prune
	@echo "发布完成：$(IMAGE):latest"
	@[ -z "$$(git status --porcelain 2>/dev/null)" ] || \
		echo "注意：工作区有未提交改动，这次发布的内容不在 git 历史里，出问题不好定位。"

deploy: up

build:
	$(COMPOSE) build --pull

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

# 只维护 latest 一个标签，重新构建后旧镜像立刻变悬空，直接清掉；
# 构建缓存封顶而不清空——清空会让下次构建退化成全量重建。
prune:
	@docker image prune -f --filter "label=com.xboard.local-image=true"
	@docker builder prune -f --max-used-space $(MAX_BUILD_CACHE) >/dev/null 2>&1 || true

# 首次安装：容器还没跑起来时用一次性容器执行，装完再 make up。
install:
	$(COMPOSE) run --rm \
		-e ENABLE_SQLITE=true \
		-e ENABLE_REDIS=true \
		xboard php artisan xboard:install
