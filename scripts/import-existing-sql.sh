#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <database_name> <path_to_hrdynt_stepoil.sql>"
  exit 1
fi

DB_NAME="$1"
SQL_FILE="$2"

mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p "${DB_NAME}" < "${SQL_FILE}"

echo "Imported ${SQL_FILE} into ${DB_NAME}"
