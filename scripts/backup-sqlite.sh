#!/usr/bin/env bash
#
# 在线备份容器内的 SQLite 数据库到 .docker/.data/backups/，保留最近 KEEP_COUNT 份。
# 用 sqlite3 .backup 而非直接复制文件，避免拷到写入中的半个事务。
#
# 手动执行：make backup
# 每日定时（crontab -e，注意 cron 的 PATH 很窄，脚本内部已自行补齐）：
#   30 4 * * * /root/Xboard/scripts/backup-sqlite.sh >> /var/log/xboard-backup.log 2>&1

set -Eeuo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH}"

# 从脚本自身位置推导项目根目录，两台服务器放在不同路径下都能用。
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly PROJECT_DIR
readonly BACKUP_DIR="${PROJECT_DIR}/.docker/.data/backups"
readonly CONTAINER_DATABASE="/www/.docker/.data/database.sqlite"
readonly CONTAINER_BACKUP_DIR="/www/.docker/.data/backups"
readonly KEEP_COUNT="${KEEP_COUNT:-7}"

timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
backup_name="daily_database_${timestamp}.sqlite"
backup_file="${BACKUP_DIR}/${backup_name}"
temporary_file="${backup_file}.tmp"
# .docker/.data 是绑定挂载，容器内写的临时文件即宿主机上的 temporary_file。
container_temporary_file="${CONTAINER_BACKUP_DIR}/${backup_name}.tmp"

umask 027
mkdir -p "${BACKUP_DIR}"
rm -f -- "${temporary_file}"

cleanup() {
  rm -f -- "${temporary_file}"
}
trap cleanup EXIT

cd "${PROJECT_DIR}"

docker compose exec -T xboard \
  sqlite3 "${CONTAINER_DATABASE}" \
  ".timeout 30000" \
  ".backup '${container_temporary_file}'"

integrity_result="$(
  docker compose exec -T xboard \
    sqlite3 "${container_temporary_file}" \
    "PRAGMA integrity_check;"
)"

if [[ "${integrity_result}" != "ok" ]]; then
  echo "SQLite 备份完整性校验失败：${integrity_result}" >&2
  exit 1
fi

mv -- "${temporary_file}" "${backup_file}"
chmod 640 "${backup_file}"
trap - EXIT

# 按修改时间倒序，删掉第 KEEP_COUNT 份之后的旧备份。
mapfile -d '' -t daily_backups < <(
  find "${BACKUP_DIR}" -maxdepth 1 -type f \
    -name 'daily_database_*.sqlite' \
    -printf '%T@ %p\0' | sort -z -nr
)

for entry in "${daily_backups[@]:${KEEP_COUNT}}"; do
  rm -f -- "${entry#* }"
done

echo "$(date '+%F %T %Z') SQLite 备份完成：${backup_file}"
