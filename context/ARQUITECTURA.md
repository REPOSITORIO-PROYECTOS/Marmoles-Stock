# ARQUITECTURA TÉCNICA Y DEPENDENCIAS - IMA MARMOL

## Stack Tecnológico

- **Infraestructura:** Docker Compose (3 servicios: `db`, `backend`, `frontend`).
- **Backend:** FastAPI (Python), SQLAlchemy (ORM), Alembic (Migraciones), PostgreSQL (DB principal).
- **Frontend:** React 18, TypeScript, Vite, Radix UI, Tailwind, React Router.

## Mapa de Módulos (Backend Routers)

La API está estrictamente dividida por dominios. Al modificar uno, verificar si hay impacto en sus adyacentes:

- `auth`: Identidad y tokens.
- `crm` & `presupuestos`: Entrada de clientes y cotizaciones.
- `inventario`: Control de stock, lotes y almacén.
- `produccion` & `planos_tecnicos`: Operaciones de corte, diseño de piezas (usa Shapely/ezdxf).
- `servicios` & `logistica`: Despacho, rutas y encuestas de satisfacción.
- `finanzas` & `finanzas_produccion`: Cuentas por cobrar, costos operativos.

## Dependencias Cruzadas y Puntos de Fricción

1. **Presupuestos -> Producción / Finanzas:** Alterar el modelo de Presupuestos impacta directamente en cómo Producción lee los requerimientos y cómo Finanzas proyecta ingresos. Auditar ambas capas al tocar `presupuestos`.
2. **Inventario -> Producción:** La reserva de materiales (placas/lotes) ocurre al lanzar la producción. No alterar lógica de stock sin revisar el consumo en `produccion`.

## Riesgos Conocidos (Deuda Técnica a Vigilar)

- **Deriva de Esquema:** Convivencia de scripts de ajuste manual con migraciones de Alembic. **Regla:** Usar únicamente Alembic para cambios de esquema para evitar inconsistencias de estado.
- **Puertos y Configuración de Entorno:** Vigilar el uso correcto de variables de entorno. Producción usa Frontend: 5120, Backend: 8020, PostgreSQL: 5432. Desarrollo local puede variar (proxy a 8000). Mantener esta configuración aislada.
