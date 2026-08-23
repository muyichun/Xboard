SHELL := /bin/bash

COMPOSE := docker compose

# 镜像导出目录（不入库，见 .gitignore）。
DIST_DIR := dist

# 关掉 BuildKit 默认的 provenance/SBOM 证明。不关的话，即使所有层都命中缓存，
# 每次构建仍会导出新的 attestation manifest，image ID 随之改变，上一个镜像平白
# 变悬空，等于每次都要多清理一次。
# 注意：compose.yaml 里的 `provenance: false` 字段实测无效（compose 解析了但不
# 会传给 buildx），只有这个环境变量管用。
export BUILDX_NO_DEFAULT_ATTESTATIONS := 1
# 构建缓存上限。缓存能让无改动重建从几分钟降到几十秒，所以不清空、只封顶。
MAX_BUILD_CACHE := 5GB

.PHONY: help release deploy build save load recreate up down restart ps logs \
        shell backup prune install versions require-clean-worktree

# release / deploy 的各步有严格先后（备份要在重建之前、验证要在导出之前），
# 并行执行会打乱顺序，这里直接禁掉 make -j。
.NOTPARALLEL:

help:
	@echo "构建机（国内，负责构建并导出镜像）："
	@echo "  make release   备份 → 构建 → 本机重建容器验证 → 导出镜像包到 $(DIST_DIR)/"
	@echo "  make build     只构建镜像，不导出"
	@echo "  make save      只导出当前镜像（要求工作区干净）"
	@echo
	@echo "生产机（海外，只导入镜像，不构建）："
	@echo "  make deploy FILE=$(DIST_DIR)/xboard-<sha>.tar.gz"
	@echo "                 备份 → 导入镜像 → 重建容器 → 清理悬空镜像"
	@echo "  make deploy    镜像已导入过时，直接重建容器"
	@echo "  make load FILE=...   只导入镜像，不重建容器"
	@echo
	@echo "两边通用："
	@echo "  make recreate  用本机已有镜像重建容器（不构建、不拉取）"
	@echo "  make versions  列出本机留存的镜像版本"
	@echo "  make restart   不换镜像，只重启容器"
	@echo "  make down      停止并移除容器（数据与镜像保留）"
	@echo "  make ps / logs / shell / backup"
	@echo "  make install   首次安装（仅新实例执行一次，需先有镜像）"
	@echo
	@echo "回滚：生产机上 XBOARD_TAG=<git短sha> make recreate —— 历史镜像还在本机，"
	@echo "不用重新传。可用的版本见 make versions。"

# ---------------------------------------------------------------------------
# 构建机流程
#
# 顺序刻意是「先在本机重建容器跑起来，再导出」：recreate 带 --wait，健康检查
# 不过就直接中断，导不出来。这样传到生产机的镜像至少是本机能正常启动的。
# ---------------------------------------------------------------------------
release: backup build recreate save
	@echo "接下来把 $(DIST_DIR)/ 下的镜像包传到生产机，在那边执行 make deploy FILE=..."

build:
	$(COMPOSE) build --pull

# 导出时打两个标签：XBOARD_TAG（平时是 latest，生产机日常跑它）和 git 短 sha
# （回滚时按它切）。镜像本来就是代码的派生物，sha 标签让「某个提交对应哪个
# 镜像」这件事不需要额外记账。
#
# 两个标签指向同一个镜像，docker save 一起导出也只存一份层数据，不会翻倍。
save: require-clean-worktree
	@ref="$$($(COMPOSE) config --images | head -n1)"; \
	repo="$${ref%:*}"; \
	sha="$$(git rev-parse --short HEAD)"; \
	docker image inspect "$$ref" >/dev/null 2>&1 || \
		{ echo "本机没有镜像 $$ref，先 make build。" >&2; exit 1; }; \
	docker tag "$$ref" "$$repo:$$sha"; \
	mkdir -p $(DIST_DIR); \
	out="$(DIST_DIR)/$${repo##*/}-$$sha.tar.gz"; \
	echo "导出 $$ref + $$repo:$$sha → $$out"; \
	docker save "$$ref" "$$repo:$$sha" | gzip --rsyncable > "$$out"; \
	ls -lh "$$out"

# 导出的镜像带 git 短 sha 标签，工作区脏的话这个标签就是假的：将来照着这个 sha
# 回滚，拿到的镜像和该提交的实际内容对不上。所以这里直接拦住。
require-clean-worktree:
	@if [ -n "$$(git status --porcelain 2>/dev/null)" ] && [ -z "$(ALLOW_DIRTY)" ]; then \
		echo "工作区有未提交改动，打出来的 sha 标签会和提交内容对不上。" >&2; \
		echo "先提交，或确认无所谓时用 ALLOW_DIRTY=1 make save 跳过。" >&2; \
		exit 1; \
	fi

# ---------------------------------------------------------------------------
# 生产机流程
# ---------------------------------------------------------------------------
# FILE 给了就先导入镜像，没给就直接用本机已有的镜像重建（回滚、改配置后重启）。
deploy: backup
	@[ -z "$(FILE)" ] || $(MAKE) --no-print-directory load FILE="$(FILE)"
	@$(MAKE) --no-print-directory recreate
	@$(MAKE) --no-print-directory prune
	@ref="$$($(COMPOSE) config --images | head -n1)"; echo "已上线：$$ref"

load:
	@[ -n "$(FILE)" ] || { echo "用法：make load FILE=$(DIST_DIR)/xboard-<sha>.tar.gz" >&2; exit 1; }
	@[ -s "$(FILE)" ] || { echo "镜像包不存在或为空：$(FILE)" >&2; exit 1; }
	docker load -i "$(FILE)"

# ---------------------------------------------------------------------------
# 两边通用
# ---------------------------------------------------------------------------
# --no-build --pull never：镜像必须已经在本机（构建机 make build 之后、生产机
# make load 之后）。缺镜像时直接报错，不会在生产机上偷偷退化成本地构建——那会
# 因为没有 submodule 而失败，或者更糟，构建出一个和你传过去的不一样的镜像。
recreate:
	$(COMPOSE) up -d --force-recreate --remove-orphans --wait --no-build --pull never

versions:
	@ref="$$($(COMPOSE) config --images | head -n1)"; \
	docker images "$${ref%:*}" --format 'table {{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'

# 旧命令。以前 make up 是「构建并发布」，两台机器同一条；现在构建机和生产机
# 流程不同，拆成了 release / deploy。这里留个明确报错，免得沿用旧习惯时默默
# 做错事（比如在生产机上以为发布了、其实只是原地重启）。
up:
	@echo "make up 已拆分：构建机用 make release，生产机用 make deploy FILE=..." >&2
	@echo "只想用现有镜像重建容器，用 make recreate。" >&2
	@exit 1

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

# 只清理悬空镜像。带 sha 标签的历史版本不是悬空的，会留下来给回滚用——因为
# 镜像层共享，多留一个版本只多占改动过的那部分（约几十 MB），不是一整个镜像。
# 留太多了手动 docker image rm xboard:<sha> 删。
# 构建缓存封顶而不清空——清空会让下次构建退化成全量重建（生产机不构建，这条
# 在那边是空转）。
prune:
	@docker image prune -f --filter "label=com.xboard.local-image=true"
	@docker builder prune -f --max-used-space $(MAX_BUILD_CACHE) >/dev/null 2>&1 || true

# 首次安装：容器还没跑起来时用一次性容器执行，装完再 make recreate。
# 生产机上要先 make load 把镜像导进来，否则这里会因为没镜像而失败。
install:
	$(COMPOSE) run --rm \
		-e ENABLE_SQLITE=true \
		-e ENABLE_REDIS=true \
		xboard php artisan xboard:install
