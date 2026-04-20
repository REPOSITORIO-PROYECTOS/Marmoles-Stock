# Mundo di Marmi · Sistema de Gestión para Marmolería

Monorepo del sistema de gestión para marmolería, con backend en FastAPI y frontend en React + Vite.  
Repositorio remoto: `https://github.com/REPOSITORIO-PROYECTOS/Marmoles-Stock.git`

## Arquitectura (Producción)

**Sistema con Docker:**
- **Frontend:** Docker + Nginx (puerto `5120`)
- **Backend:** Docker + FastAPI (puerto `8020`)
- **Database:** Docker PostgreSQL (puerto `5432`)

## Estructura
- `backend/`: API `FastAPI` con `SQLAlchemy`, `Alembic` y endpoints de salud
- `frontend/app/`: Frontend principal en React + Vite
- `docker-compose.yml`: Configuración de servicios Docker
- `update.sh`: Script de actualización/deploy
- `deploy_status.sh`: Verificación de estado de servicios

## Requisitos
- `Node.js >= 18` y `npm`.
- `Python >= 3.10`, `pip` y `virtualenv` (opcional).
- **Docker Desktop** encendido, para PostgreSQL local y migraciones completas.

## Repositorio Git
```bash
git remote add origin https://github.com/REPOSITORIO-PROYECTOS/Marmoles-Stock.git
git branch -M main
git push -u origin main
```
(El primer `push` pide autenticación en GitHub.)

## Base de datos nueva (PostgreSQL local)
1. Opcional — borrar volumen previo y empezar vacío: `docker compose down -v` (desde la carpeta `marmoles`).
2. Windows: `.\scripts\bootstrap_db.ps1` — levanta `db` y ejecuta `alembic upgrade heads`.
3. Copiar `backend/.env.example` a `backend/.env` (misma `DATABASE_URL` que usa el script).

## Backend (desarrollo)
- `cd backend`
- Crear entorno virtual:
  - Windows: `py -3 -m venv .venv` luego `.\.venv\Scripts\activate`
  - Linux/Mac: `python -m venv .venv && source .venv/bin/activate`
- Instalar dependencias: `pip install -r requirements.txt`
- Iniciar API: `uvicorn app.main:app --reload`
- Health checks: `GET /health` y `GET /api/health` (`backend/app/main.py:29`, `backend/app/main.py:33`).

## Frontend principal (desarrollo)
- `cd frontend/app`
- `npm install`
- `npm run dev`
- Abrir `http://localhost:3000/`
- Proxy de desarrollo a la API configurado en `frontend/app/vite.config.ts:61–69` hacia `http://127.0.0.1:8000`.

### Variables de entorno (frontend)
- Archivo `.env` en `frontend/app` (opcional):
  - `VITE_API_BASE_URL=http://127.0.0.1:8000`
- Si no se define, el frontend usa `http://127.0.0.1:8000` en modo dev y `https://marmoles.sistemataup.online` en producción (`frontend/app/src/config.ts:4–7`).

### Modo local con SQLite (sin Postgres)
- Base usada en la prueba: `marmoles/dev_inventory_e2e.db` (copia de `dev_inventory.db` + import Excel).
- En **PowerShell**, desde `marmoles/backend`:
  ```powershell
  $env:DATABASE_URL = "sqlite:///../dev_inventory_e2e.db"
  .\.venv\Scripts\python scripts/import_control_inventario_xlsx.py --dry-run
  .\.venv\Scripts\python scripts/import_control_inventario_xlsx.py --create-materials
  .\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```
- O desde `marmoles`: `.\scripts\run_local_sqlite.ps1` (usa la misma DB por ruta absoluta).
- Luego Postgres en producción: volvé a `DATABASE_URL` de `backend/.env.example` y `docker compose`.

### Importar placas desde Excel (Control de Bloques)
- Archivo esperado en la raíz del workspace padre: `Control_Inventario_Marmoleria 2026.xlsx` (o pasá `--file`).
- Requiere PostgreSQL en marcha (`docker compose up -d db` o `.\scripts\bootstrap_db.ps1`).
- Simulación: `cd backend` → `.\.venv\Scripts\python scripts/import_control_inventario_xlsx.py --dry-run`
- Carga real (crea materiales si no existen): `.\.venv\Scripts\python scripts/import_control_inventario_xlsx.py --create-materials`
- La hoja **RECORTES** (piezas en L con varios tramos) no se importa automáticamente; son geometrías compuestas.

## Scripts útiles
- Frontend principal:
  - `cd frontend/app && npm run dev` inicia el servidor de desarrollo.
  - `cd frontend/app && npm run build` genera el build en `frontend/app/build`.
  - `cd frontend/app && npm test` ejecuta pruebas con Vitest.
- Proyecto raíz (sandbox):
  - `npm run dev`, `npm run build`, `npm run preview`.
  - `npm run lint` usa la configuración de `eslint.config.js`.

## Pruebas
- Backend: `cd backend && pytest` (tests en `backend/app/tests` y `backend/app/src/corte_modulo/tests`).
- Frontend: `cd frontend/app && npm test` (config en `frontend/app/src/test/setup.ts`).

## Despliegue (Producción)

### Despliegue inicial o actualización
```bash
# Ejecutar script de actualización
bash update.sh
```

### Verificar Estado
```bash
# Ver estado de todos los servicios
bash deploy_status.sh

# Ver logs de Docker
docker logs marmoles_frontend
docker logs marmoles_backend
docker logs marmoles_db
```

**Documentación completa:** Ver [SISTEMA_HIBRIDO_PM2.md](SISTEMA_HIBRIDO_PM2.md)
- Configuración de Nginx y servicios en `deploy/nginx/` y `deploy/systemd/`.
- Base de datos y utilidades en `deploy/docker/` y `deploy/db/`.

## Estructura rápida
- API: `backend/app/main.py:14` define la aplicación FastAPI y CORS.
- Frontend: `frontend/app/vite.config.ts:58` define puerto `3000` y proxy.
- Router (sandbox raíz): `src/App.tsx:1–11` con `react-router-dom`.

## Notas
- Este README describe el proyecto completo. Para detalles de branding y componentes del frontend principal, ver `frontend/app/README.md`.
