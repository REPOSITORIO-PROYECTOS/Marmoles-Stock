# Resumen del Proyecto IMA MARMOL

## 1. Objetivo general

IMA MARMOL es un sistema de gestión para marmolería en formato monorepo. Está diseñado para centralizar operaciones comerciales, productivas y logísticas en una sola plataforma.

El sistema combina:

- Backend API con FastAPI + SQLAlchemy
- Frontend web con React + Vite
- Base de datos PostgreSQL
- Orquestación con Docker Compose para entorno productivo

## 2. Arquitectura y stack

### Backend

- Framework: FastAPI
- ORM: SQLAlchemy
- Migraciones: Alembic
- Base de datos principal: PostgreSQL (con posibilidad de usar SQLite en desarrollo local por variable de entorno)
- Seguridad/autenticación: python-jose + passlib
- Otros componentes relevantes: shapely, ezdxf, matplotlib, python-multipart

### Frontend

- Framework: React 18 + TypeScript
- Bundler: Vite
- UI: Radix UI + utilidades de diseño (tailwind-merge, class-variance-authority, etc.)
- Routing: react-router-dom
- Testing frontend: Vitest + Testing Library
- E2E: Cypress

### Infraestructura

- Docker Compose con 3 servicios principales:
- db (PostgreSQL)
- backend (FastAPI)
- frontend (build con Dockerfile.frontend)

Puertos de producción definidos en compose:

- Frontend: 5120
- Backend: 8020
- PostgreSQL: 5432

## 3. Estructura del repositorio

- backend/: API, modelos, routers, migraciones y pruebas técnicas
- frontend/app/: aplicación web principal
- scripts/: utilidades operativas y mantenimiento
- docker-compose.yml: levantamiento del stack de producción
- update.sh y deploy_status.sh: automatización básica de despliegue y verificación

## 4. Módulos funcionales principales

Del lado backend, la API integra routers por dominios de negocio:

- auth
- inventario
- produccion
- crm
- presupuestos
- finanzas
- finanzas_produccion
- planos_tecnicos
- servicios
- logistica (incluyendo encuestas)

Esto sugiere un flujo completo de punta a punta: captación/comercial (CRM y presupuestos), abastecimiento e inventario, ejecución operativa (producción), entrega/logística y control financiero.

## 5. Funcionamiento de la API

Puntos base observados:

- /health y /api/health para health check
- / con respuesta de estado de servicio

Características relevantes:

- Middleware CORS habilitado para entornos locales y dominio productivo
- Manejador global de excepciones para registrar errores y devolver respuesta 500 estructurada
- Inicialización con validaciones/ajustes de columnas en tablas CRM (patrón defensivo para compatibilidad de esquema)

## 6. Base de datos y migraciones

- Alembic está configurado y hay múltiples revisiones en backend/alembic/versions
- Existe evidencia de evolución continua del esquema (campos y merges de heads)
- El backend obtiene DATABASE_URL desde entorno y define fallback PostgreSQL

Implicación: el proyecto está preparado para cambios frecuentes de datos y necesita disciplina de migraciones para mantener consistencia entre ambientes.

## 7. Frontend y comunicación con backend

- En desarrollo, Vite configura proxy de /api, /health, /static y /uploads hacia http://127.0.0.1:8000
- La configuración de API base en frontend se adapta por modo (test/dev/prod)
- El frontend incluye componentes y páginas suficientes para un dashboard empresarial con módulos múltiples

## 8. Pruebas y aseguramiento de calidad

Hay pruebas y scripts de validación en varias capas:

- Tests de backend y pruebas funcionales en backend/tests
- Scripts de pruebas de flujo en la raíz (ej. test_flujo.py, test_lotes_crud.py)
- Tests frontend con Vitest
- Pruebas E2E con Cypress

Conclusión de calidad: existe cultura de validación práctica, con mezcla de pruebas automatizadas y scripts manuales/operativos.

## 9. Operación y despliegue

- update.sh: orientado a actualizar/desplegar
- deploy_status.sh: orientado a verificar estado
- Compose incorpora healthchecks y límites/reservas de recursos

Esto muestra un enfoque de operación pragmático para producción en contenedor.

## 10. Fortalezas del proyecto

- Cobertura funcional amplia para negocio real de marmolería
- Separación clara backend/frontend
- Infra reproducible con Docker
- Módulos de negocio explícitos por dominio
- Presencia de pruebas y scripts de diagnóstico

## 11. Riesgos y deuda técnica observable

- Coexisten señales de distintos puertos/configuraciones entre documentación y código, lo que puede causar fricción en onboarding
- Conviven scripts manuales de migración/ajuste con Alembic; si no se gobierna bien, puede aparecer deriva de esquema
- Alta cantidad de módulos y scripts auxiliares: requiere estandarizar convenciones para mantener escalabilidad del equipo

## 12. Recomendaciones inmediatas

1. Unificar documentación de ejecución local y puertos efectivos (backend/frontend/proxy).
2. Definir política única de cambios de esquema (Alembic como fuente oficial + scripts solo para tareas excepcionales).
3. Consolidar una guía de pruebas por capa (rápidas, integración, E2E) con comandos estándar.
4. Publicar mapa funcional de módulos y dueños para facilitar mantenimiento.

## 13. Resumen ejecutivo

El proyecto IMA MARMOL está en una etapa madura a nivel funcional y técnico, con arquitectura moderna, dominio de negocio amplio y capacidades de despliegue claras. El principal margen de mejora está en la estandarización operativa (documentación, migraciones y flujo de pruebas), más que en una carencia de base tecnológica.
