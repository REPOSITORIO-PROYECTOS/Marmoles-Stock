# Levanta la API con SQLite local (venv en backend).
# Uso: desde la carpeta marmoles  ->  .\scripts\run_local_sqlite.ps1

$ErrorActionPreference = "Stop"
$marmolesRoot = Split-Path -Parent $PSScriptRoot
$dbFile = Join-Path $marmolesRoot "dev_inventory_e2e.db"
if (-not (Test-Path $dbFile)) {
    Write-Host "No existe $dbFile — copiá dev_inventory.db o ejecutá el import primero." -ForegroundColor Yellow
}
# SQLAlchemy en Windows: tres barras + ruta con /
$abs = (Resolve-Path $dbFile).Path.Replace("\", "/")
$env:DATABASE_URL = "sqlite:///$abs"
$backend = Join-Path $marmolesRoot "backend"
Set-Location $backend
if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    throw "Creá el venv en backend: py -3 -m venv .venv ; pip install -r requirements.txt"
}
Write-Host "DATABASE_URL=$env:DATABASE_URL" -ForegroundColor Cyan
& .\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
