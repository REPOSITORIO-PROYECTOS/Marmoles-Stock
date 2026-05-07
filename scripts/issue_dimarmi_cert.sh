#!/usr/bin/env bash
set -euo pipefail
# Uso: bash scripts/issue_dimarmi_cert.sh
# Requiere: dimarmi.conf en cerebro solo con ACME (puerto 80), DNS apuntando al servidor.

CEREBRO_NGINX="/home/agencia/proyectos/cerebro/nginx/conf.d"

docker run --rm \
  -v /home/agencia/proyectos/cerebro/certbot/conf:/etc/letsencrypt \
  -v /home/agencia/proyectos/cerebro/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot --webroot-path=/var/www/certbot \
  -d dimarmi.sistemataup.online \
  --register-unsafely-without-email --agree-tos --non-interactive

install -m 0644 "${CEREBRO_NGINX}/dimarmi.conf.https" "${CEREBRO_NGINX}/dimarmi.conf"

docker exec cerebro_nginx nginx -t
docker exec cerebro_nginx nginx -s reload

echo "HTTPS activo para dimarmi.sistemataup.online"
