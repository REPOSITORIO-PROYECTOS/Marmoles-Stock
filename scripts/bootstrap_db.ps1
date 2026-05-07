# Crea / actualiza el esquema en PostgreSQL local (Docker).
# Uso (desde la carpeta marmoles):  .\scripts\bootstrap_db.ps1
# Base nueva desde cero (BORRA datos del volumen):  docker compose down -v  luego volver a ejecutar este script.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Levantando PostgreSQL (docker compose up -d db)..." -ForegroundColor Cyan
docker compose up -d db

$dbUrl = "postgresql+psycopg2://marmoles_user:marmoles_password@127.0.0.1:5432/marmoles_db"
$backend = Join-Path $root "backend"
Set-Location $backend

Write-Host "Esperando a que Postgres acepte conexiones..." -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    docker exec marmoles_db pg_isready -U marmoles_user 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}

$env:DATABASE_URL = $dbUrl
Write-Host "Aplicando migraciones (alembic upgrade heads)..." -ForegroundColor Cyan
py -3 -m alembic upgrade heads

Write-Host "Listo. DATABASE_URL para desarrollo local:" -ForegroundColor Green
Write-Host $dbUrl
