#!/usr/bin/env bash
# Linux Docker host: disposable network, SQLite and Redis; no host data mounts.
set -euo pipefail
cd -- "$(dirname -- "$0")/../.."
project_dir="$PWD"
python_cmd="${PYTHON:-python3}"
"$python_cmd" -c 'import playwright' >/dev/null
command -v "${CHROMIUM_PATH:-chromium}" >/dev/null
run_name="xboard-admin-acceptance-$$"
cleanup() {
  docker rm -f "$run_name" >/dev/null 2>&1 || true
  docker network rm "$run_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
if [[ "${SKIP_ADMIN_BUILD:-0}" != 1 ]]; then
  docker run --rm -v "$project_dir:/repo" -w /repo/admin node:22-alpine \
    sh -c 'npx --yes pnpm@12.21.0 install --frozen-lockfile && npx --yes pnpm@12.21.0 test && npx --yes pnpm@12.21.0 build'
fi
docker network create --internal "$run_name" >/dev/null
docker run -d --name "$run_name" --network "$run_name" \
  --label com.xboard.admin-test=true \
  -e APP_ENV=testing -e APP_KEY=base64:OExNMC9mS3ZHZzB2cFBtN2Z1UGJVWUxOcktaeDJmdk4= \
  -e DB_CONNECTION=sqlite -e DB_DATABASE=.docker/.data/admin-test.sqlite \
  -e CACHE_DRIVER=redis -e REDIS_HOST=127.0.0.1 -e QUEUE_CONNECTION=sync \
  -e MAIL_DRIVER=log -e MAIL_MAILER=log -e INSTALLED=true \
  -v "$project_dir/app:/www/app:ro" -v "$project_dir/routes:/www/routes:ro" \
  -v "$project_dir/resources:/www/resources:ro" \
  -v "$project_dir/database/migrations:/www/database/migrations:ro" \
  -v "$project_dir/public/assets/admin-next:/www/public/assets/admin-next:ro" \
  -v "$project_dir/tests/Admin:/tests:ro" \
  --entrypoint sh "${ADMIN_TEST_IMAGE:-xboard:latest}" -c \
  'touch /www/.docker/.data/admin-test.sqlite && redis-server --daemonize yes && php artisan migrate --force >/tmp/migrations.log && php /tests/seed.php && php /tests/parity.php && php /tests/traffic.php && php artisan serve --host=0.0.0.0 --port=7001' >/dev/null
container_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$run_name")"
# The host browser, HTTP client and readiness check talk directly to the isolated container.
unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY
ready=0
for attempt in $(seq 1 60); do
  if curl --max-time 2 -fsS "http://$container_ip:7001/admin-test?admin_ui=next" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then docker logs "$run_name"; exit 1; fi
if [[ "${SKIP_ADMIN_BROWSER:-0}" != 1 ]]; then
  ADMIN_TEST_ORIGIN="http://$container_ip:7001" "$python_cmd" -u tests/Admin/traffic.py
  ADMIN_TEST_ORIGIN="http://$container_ip:7001" "$python_cmd" -u tests/Admin/browser.py
fi
ADMIN_TEST_ORIGIN="http://$container_ip:7001" "$python_cmd" -u tests/Admin/api.py
if [[ "${SKIP_ADMIN_BROWSER:-0}" != 1 ]]; then
  ADMIN_TEST_ORIGIN="http://$container_ip:7001" "$python_cmd" -u tests/Admin/button_checks.py
  docker exec "$run_name" php /tests/verify_buttons.php
fi
