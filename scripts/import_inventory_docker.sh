#!/usr/bin/env bash
set -euo pipefail
# Importa el Excel definido en CONTROL_INVENTARIO_XLSX del .env (puede llevar comillas y espacios).

cd "$(dirname "$0")/.."

XLSX=$(grep -E '^CONTROL_INVENTARIO_XLSX=' .env | head -1 | sed 's/^CONTROL_INVENTARIO_XLSX=//' | sed 's/^"//;s/"$//')
if [[ -z "${XLSX}" ]]; then
  echo "Definir CONTROL_INVENTARIO_XLSX en .env" >&2
  exit 1
fi
test -f "$XLSX" || { echo "No existe: $XLSX" >&2; exit 1; }

docker compose -p dimarmi --env-file .env run --rm \
  -v "${XLSX}:/import/inventory.xlsx:ro" \
  backend \
  python scripts/import_control_inventario_xlsx.py --file /import/inventory.xlsx --create-materials
