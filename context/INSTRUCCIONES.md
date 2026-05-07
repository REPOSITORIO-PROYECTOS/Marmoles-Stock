# INSTRUCCIONES DEL SISTEMA: IMA MARMOL

## Propósito del Sistema

Sistema integral de gestión para marmolería. Centraliza operaciones comerciales, productivas y logísticas en un único flujo de trabajo punta a punta.

## Estructura Principal de Carpetas

- `/backend`: API en FastAPI, modelos SQLAlchemy, routers por dominio y migraciones de Alembic.
- `/frontend/app`: Aplicación web principal en React 18 + Vite.
- `/scripts`: Utilidades operativas, diagnósticos e inserción de datos.
- `/backend/tests` & `/frontend/tests`: Entornos de validación funcional y unitaria.

## Flujo Principal de Negocio

El sistema sigue este ciclo vital. Un cambio en un eslabón suele afectar al siguiente:

1. **Captación:** CRM -> Presupuestos.
2. **Abastecimiento:** Inventario (Lotes, Placas).
3. **Ejecución:** Producción -> Planos Técnicos (Shapely, ezdxf).
4. **Cierre:** Logística (Entregas/Encuestas) -> Finanzas (Facturación, Finanzas Producción).

## Comandos Críticos de Validación (Usar al finalizar tareas)

- **Backend Tests:** `pytest backend/tests/` o correr scripts puntuales como `python test_flujo.py`.
- **Frontend Unit Tests:** `npm run test` (Vitest).
- **Frontend E2E:** `npx cypress run` (o el equivalente definido en package.json).
- **Levantar Entorno (Local/Prod):** `docker-compose up -d` (PostgreSQL, Backend FastAPI, Frontend Vite).
- **Migraciones:** `alembic upgrade head` (ubicado dentro de `/backend`).

## Dominios Sensibles

- **Módulo de Autenticación y Permisos:** Requiere extrema cautela.
- **Sincronización Presupuestos-Finanzas:** La transición de un presupuesto aprobado a su estado financiero y orden de producción.
- **Configuración de Proxy Frontend:** La conexión `/api` hacia `http://127.0.0.1:8000` (entorno dev) no debe romperse.
