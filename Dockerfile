FROM phpswoole/swoole:php8.2-alpine

COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

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
