#!/usr/bin/env bash
# Prueba rápida: placas por lote, sincronizar y endpoints de despacho.
set -eu

API="${API_BASE:-http://127.0.0.1:4921}"
USER="${TEST_USER:-admin}"
PASS="${TEST_PASS:-}"

if [[ -z "$PASS" ]]; then
  if [[ -f "$(dirname "$0")/../.env" ]]; then
    PASS=$(grep -E '^ADMIN_PASSWORD=' "$(dirname "$0")/../.env" | cut -d= -f2- | tr -d '\r"' || true)
  fi
fi

if [[ -z "$PASS" ]]; then
  echo "FAIL: defina TEST_PASS o ADMIN_PASSWORD en .env"
  exit 1
fi

echo "== Login $API =="
TOKEN=$(curl -sS -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"usuario\":\"$USER\",\"password\":\"$PASS\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

if [[ -z "$TOKEN" || "$TOKEN" == "None" ]]; then
  echo "FAIL: login sin token"
  exit 1
fi
echo "OK login"

AUTH=(-H "Authorization: Bearer $TOKEN")

echo "== Buscar lote con placas =="
LOTE_ID=$(curl -sS "${AUTH[@]}" "$API/api/placas?estado=disponible" | python3 -c "
import sys, json
rows = json.load(sys.stdin)
if not rows:
    sys.exit(1)
for r in rows:
    if r.get('lote_id'):
        print(r['lote_id'])
        break
else:
    sys.exit(1)
" || true)

if [[ -z "$LOTE_ID" ]]; then
  echo "WARN: sin placas disponibles con lote_id; probando cualquier placa"
  LOTE_ID=$(curl -sS "${AUTH[@]}" "$API/api/placas" | python3 -c "
import sys, json
rows = json.load(sys.stdin)
for r in rows:
    if r.get('lote_id'):
        print(r['lote_id'])
        break
" || true)
fi

if [[ -z "$LOTE_ID" ]]; then
  echo "FAIL: no hay placas en BD para probar"
  exit 1
fi
echo "OK lote_id=$LOTE_ID"

echo "== GET placas por lote =="
COUNT=$(curl -sS "${AUTH[@]}" "$API/api/placas?lote_id=$LOTE_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "OK placas en lote: $COUNT"

echo "== POST sincronizar-placas =="
SYNC=$(curl -sS -X POST "${AUTH[@]}" "$API/api/lotes/$LOTE_ID/sincronizar-placas")
echo "$SYNC" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'stock_actual' in d and 'placas_disponibles' in d; print('OK sync', d)"

echo "== Verificar rutas despachar (smoke) =="
CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${AUTH[@]}" "$API/api/lotes/00000000-0000-0000-0000-000000000000/despachar-placas")
if [[ "$CODE" == "404" ]]; then
  echo "OK despachar 404 en lote inexistente"
else
  echo "FAIL despachar code=$CODE"
  exit 1
fi

echo "PASS: prueba placas/lote completada"
