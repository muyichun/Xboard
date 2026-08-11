#!/usr/bin/env bash

set -Eeuo pipefail

readonly PROJECT_DIR="/root/Xboard"
readonly BACKUP_DIR="${PROJECT_DIR}/.docker/.data/backups"
readonly CONTAINER_DATABASE="/www/.docker/.data/database.sqlite"
readonly CONTAINER_BACKUP_DIR="/www/.docker/.data/backups"
readonly KEEP_COUNT=7

timestamp="$(date '+%Y-%m-%d_%H-%M-%S')"
backup_name="daily_database_${timestamp}.sqlite"
backup_file="${BACKUP_DIR}/${backup_name}"
temporary_file="${backup_file}.tmp"
container_temporary_file="${CONTAINER_BACKUP_DIR}/${backup_name}.tmp"

umask 027
mkdir -p "${BACKUP_DIR}"
rm -f -- "${temporary_file}"

cleanup() {
  rm -f -- "${temporary_file}"
}
trap cleanup EXIT

cd "${PROJECT_DIR}"

/usr/bin/docker compose exec -T xboard \
  /usr/bin/sqlite3 "${CONTAINER_DATABASE}" \
  ".timeout 30000" \
  ".backup '${container_temporary_file}'"

integrity_result="$(
  /usr/bin/docker compose exec -T xboard \
    /usr/bin/sqlite3 "${container_temporary_file}" \
    "PRAGMA integrity_check;"
)"

if [[ "${integrity_result}" != "ok" ]]; then
  echo "SQLite backup integrity check failed: ${integrity_result}" >&2
  exit 1
fi

mv -- "${temporary_file}" "${backup_file}"
chmod 640 "${backup_file}"
trap - EXIT

mapfile -d '' -t daily_backups < <(
  find "${BACKUP_DIR}" -maxdepth 1 -type f \
    -name 'daily_database_*.sqlite' \
    -printf '%T@ %p\0' | sort -z -nr
)

for entry in "${daily_backups[@]:${KEEP_COUNT}}"; do
  old_backup="${entry#* }"
  rm -f -- "${old_backup}"
done

echo "$(date '+%F %T %Z') SQLite backup completed: ${backup_file}"
