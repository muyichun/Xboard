# 基础镜像按 digest 钉死，为的是「同一个提交永远构建出同一个底座」：回滚到旧
# 提交重新构建时，拿到的不会是几个月后飘走的新 tag。镜像源的 tag 可能滞后于
# Docker Hub，因此固定 Docker Hub 的多架构索引 digest，并在构建时检查 PHP
# 安全修复版本。更新 digest 后按 deploy.md 的发布流程构建、验证并部署。
FROM mlocati/php-extension-installer:latest@sha256:b6d3fa381b9ba5cf051117c1c601d6a523b590e534bf3d56eb4fbe352949c138 AS php-ext-installer

FROM phpswoole/swoole:php8.2-alpine@sha256:abb68c99b02e12aec9330eae7e1225f3801820be76fc639dd1d1e97afa114c7c

RUN php -r 'if (version_compare(PHP_VERSION, "8.2.35", "<")) { \
    fwrite(STDERR, "PHP >= 8.2.35 is required; found " . PHP_VERSION . "\n"); exit(1); \
}'

# 构建加速源。默认走阿里云，构建机在国内，无需任何额外配置；换到海外机器上构建时
# 置空即可回到官方源：
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

# 给 Xboard 自己的镜像打标，让发布后的清理（make prune）只回收被顶替掉的本项目
# 镜像，不去动这台机器上其它 Docker 项目的东西。生产机导入的镜像同样带着这个标。
LABEL com.xboard.local-image="true"

ENV ENABLE_WEB=true \
    ENABLE_HORIZON=true \
    ENABLE_REDIS=true \
    ENABLE_WS_SERVER=true \
    ENABLE_CADDY=true

EXPOSE 7001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
