SHELL := /bin/bash

COMPOSE := docker compose
BASE_FILES := -f compose.yaml
DEV_FILES := $(BASE_FILES) -f compose.dev.yaml
DEPLOY_FILES := $(BASE_FILES) -f compose.deploy.yaml

.PHONY: dev deploy backup cleanup-images down ps logs config-dev config-deploy

# Build the current checkout and switch the project to development mode.
dev:
	$(COMPOSE) $(DEV_FILES) up -d --build --remove-orphans
	$(MAKE) cleanup-images

# Back up SQLite (when present), build a fresh local image, and atomically
# switch the project to deployment mode. Development-only services are removed.
deploy: backup
	$(COMPOSE) $(DEPLOY_FILES) build --pull
	$(COMPOSE) $(DEPLOY_FILES) up -d --force-recreate --remove-orphans
	$(MAKE) cleanup-images

backup:
	@if [[ -s .docker/.data/database.sqlite ]] && \
		$(COMPOSE) $(BASE_FILES) ps --status running --services | grep -qx xboard; then \
		./scripts/backup-sqlite.sh; \
	else \
		echo "SQLite backup skipped (database or running xboard container not found)."; \
	fi

# `docker image prune` defaults to dangling images. These label filters confine
# deletion to superseded Xboard application images and preserve build cache.
# The Compose labels also cover images built before the fixed Dockerfile label
# was introduced.
cleanup-images:
	@docker image prune -f --filter "label=com.xboard.local-image=true"
	@docker image prune -f \
		--filter "label=com.docker.compose.project=xboard" \
		--filter "label=com.docker.compose.service=xboard"

# The development model contains every optional service, so it can stop either
# mode and clean up a previously running cloudflared container.
down:
	$(COMPOSE) $(DEV_FILES) down --remove-orphans

ps:
	$(COMPOSE) $(DEV_FILES) ps

logs:
	$(COMPOSE) $(DEV_FILES) logs -f --tail=100

config-dev:
	$(COMPOSE) $(DEV_FILES) config --quiet

config-deploy:
	$(COMPOSE) $(DEPLOY_FILES) config --quiet
