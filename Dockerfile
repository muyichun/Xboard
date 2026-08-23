# 基础镜像按 digest 钉死。国内镜像源和 Docker Hub 对同一个 tag 会返回不同的镜像
# （实测 php8.2-alpine：镜像源给 041b8f1b，Hub 给 e2a069cb），不钉死会让开发机和
# 生产机构建在不同基础上。这里统一采用 Docker Hub 官方那一版；国内镜像源按 digest
# 也能拉到。升级基础镜像的步骤见 deploy.md。
FROM mlocati/php-extension-installer:latest@sha256:b6d3fa381b9ba5cf051117c1c601d6a523b590e534bf3d56eb4fbe352949c138 AS php-ext-installer

FROM phpswoole/swoole:php8.2-alpine@sha256:e2a069cbb6b2939902979a07c9835df68430e22d7fad536d68d1bc2a9307bc3a

# 构建加速源。默认走阿里云，国内机器无需任何额外配置；海外机器构建时置空即可回到官方源：
#   docker compose build --build-arg ALPINE_MIRROR= --build-arg COMPOSER_MIRROR=
# 也可在 .env 里设 ALPINE_MIRROR= / COMPOSER_MIRROR= 覆盖（见 compose.yaml）。
ARG ALPINE_MIRROR=https://mirrors.aliyun.com/alpine
ARG COMPOSER_MIRROR=https://mirrors.aliyun.com/composer/

# 换 apk 源；镜像站万一没同步到当前 alpine 版本，自动回退官方 CDN，不让构建卡死。
RUN if [ -n "${ALPINE_MIRROR}" ]; then \
        cp /etc/apk/repositories /etc/apk/repositories.orig && \
        sed -i "s|https://dl-cdn.alpinelinux.org/alpine|${ALPINE_MIRROR}|g" /etc/apk/repositories && \
        if apk update >/dev/null 2>&1; then \
            echo "[build] apk 源: ${ALPINE_MIRROR}"; \
        else \
            echo "[build] 镜像站不可用，回退 dl-cdn.alpinelinux.org" >&2; \
            mv /etc/apk/repositories.orig /etc/apk/repositories; \
        fi; \
        rm -f /etc/apk/repositories.orig; \
    fi

COPY --from=php-ext-installer /usr/bin/install-php-extensions /usr/local/bin/

# Install PHP extensions one by one with lower optimization level for ARM64 compatibility
RUN CFLAGS="-O0" install-php-extensions pcntl && \
    CFLAGS="-O0 -g0" install-php-extensions bcmath && \
    install-php-extensions zip && \
    install-php-extensions redis && \
    apk --no-cache add shadow sqlite mysql-client mysql-dev mariadb-connector-c git patch supervisor redis caddy && \
    addgroup -S -g 1000 www && adduser -S -G www -u 1000 www && \
    (getent group redis || addgroup -S redis) && \
    (getent passwd redis || adduser -S -G redis -H -h /data redis)

WORKDIR /www

ENV COMPOSER_ALLOW_SUPERUSER=1

# 换 composer 源。阿里云是 packagist 全量镜像并代理 dist 包，装依赖时不必再回源 GitHub。
RUN if [ -n "${COMPOSER_MIRROR}" ]; then \
        composer config -g repos.packagist composer "${COMPOSER_MIRROR}" && \
        echo "[build] composer 源: ${COMPOSER_MIRROR}"; \
    fi

# Cache production dependencies independently from application source. The
# second install below generates the optimized autoloader and runs Laravel's
# package discovery after all local source files have been copied.
COPY composer.json composer.lock /www/
RUN composer install \
        --no-cache \
        --no-dev \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --no-scripts \
        --no-autoloader \
        --no-security-blocking

COPY .docker/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY .docker/caddy/Caddyfile /etc/caddy/Caddyfile
COPY .docker/php/zz-xboard.ini /usr/local/etc/php/conf.d/zz-xboard.ini
COPY .docker/entrypoint.sh /entrypoint.sh

# Build exactly the source and dependency lock file from the current checkout.
# Runtime secrets and persistent data are excluded by .dockerignore.
COPY . /www

RUN test -s /www/public/assets/admin/manifest.json || \
        (echo >&2 "Missing admin assets. Run: git submodule update --init --recursive"; exit 1) \
    && build_hash="$(find app bootstrap config database plugins-core public/assets/admin resources routes theme \
        -type f -exec sha256sum {} \; | sort | sha256sum | cut -c1-7)" \
    && printf '%s:%s\n' "$(date -u +%Y%m%d)" "${build_hash}" > /www/.build-version \
    && mkdir -p \
        /www/.docker/.data \
        /www/bootstrap/cache \
        /www/plugins \
        /www/public/plugins \
        /www/public/theme \
        /www/storage/app/public \
        /www/storage/framework/cache/data \
        /www/storage/framework/sessions \
        /www/storage/framework/views \
        /www/storage/logs \
        /www/storage/theme \
        /www/storage/tmp \
        /data \
    && composer install \
        --no-cache \
        --no-dev \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --optimize-autoloader \
        --no-security-blocking \
    && php artisan storage:link \
    && chown -R www:www \
        /www/.docker/.data \
        /www/bootstrap/cache \
        /www/plugins \
        /www/public/plugins \
        /www/public/theme \
        /www/storage \
    && chmod -R ug+rwX \
        /www/.docker/.data \
        /www/bootstrap/cache \
        /www/plugins \
        /www/public/plugins \
        /www/public/theme \
        /www/storage \
    && chown redis:redis /data \
    && chmod +x /entrypoint.sh

# Mark locally built application images so post-deploy cleanup can remove only
# superseded Xboard images without pruning unrelated Docker projects.
LABEL com.xboard.local-image="true"

ENV ENABLE_WEB=true \
    ENABLE_HORIZON=true \
    ENABLE_REDIS=true \
    ENABLE_WS_SERVER=true \
    ENABLE_CADDY=true

EXPOSE 7001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
