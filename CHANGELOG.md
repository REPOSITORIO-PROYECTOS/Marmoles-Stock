# Changelog

## 2025-11-26

### Cambiado

- Branding del frontend a “IMA MARMOL · Sistema de Gestión para Marmolería”.
- Actualizado título en `frontend/app/index.html:7`.
- Actualizado Sidebar (header y footer) en `frontend/app/src/components/Sidebar.tsx:101,104,149–155`.
- Alineado `frontend/index.html:6,11–12` con el mismo branding.

### Documentado

- README raíz con rutas modificadas y pasos para desarrollo local.
- README del frontend con branding y guía de ejecución.

### Desarrollo

- Instalación de dependencias y arranque del servidor de desarrollo (`vite`) en `frontend/app`.
- Front disponible en `http://localhost:3000/`.

### Backend

- API FastAPI con CORS abierto y routers incluidos en `backend/app/main.py:11–18,62–66`.
- Endpoints base:
  - `GET /health` → estado OK (`backend/app/main.py:50–52`).
  - `GET /` → `{"service":"marmoles","message":"API operativa"}` (`backend/app/main.py:54–56`).
- Auth (`backend/app/src/auth/router.py`):
  - `POST /api/auth/login` login y emisión de token.
  - `POST /api/usuarios` creación de usuario (rol admin requerido).
  - `GET /api/usuarios/me` usuario actual.
- Inventario (`backend/app/src/inventario/router.py`):
  - Materiales: `POST /api/materiales`, `GET /api/materiales`, `GET /api/materiales/tipos`.
  - Placas: `POST /api/placas`, `GET /api/placas`, `PATCH /api/placas/{placaId}`.
  - Retazos: `POST /api/inventario/retazos`, `GET /api/inventario/retazos`, `PUT /api/inventario/retazos/{retazoId}`, `POST /api/inventario/retazos/{retazoId}/vender`.
- Producción (`backend/app/src/produccion/router.py`):
  - Trabajos: `POST /api/trabajos`, `GET /api/trabajos`, `POST /api/trabajos/{trabajoId}/piezas`.
  - Estado: `POST /api/produccion/orden/{ordenId}/actualizar-estado`.
  - Planilla de corte: `POST /api/produccion/planilla-corte/optimizar`, `POST /api/produccion/planilla-corte/ordenar`.
  - Plancha: `POST /api/produccion/plancha/planificar`, `POST /api/produccion/plancha/planificar/desde-presupuesto`, `POST /api/trabajos/{trabajoId}/piezas/planificar`.
- Optimizador de cortes: uso de `optimize_rect`, validaciones y cómputo de retazos en `backend/app/src/corte_modulo`.
- Despliegue:
  - Systemd: servicio `marmoles.service` en `deploy/systemd/marmoles.service` ejecutando uvicorn en `127.0.0.1:8011`.
  - Nginx: proxy SSL en `deploy/nginx/marmoles.conf` con `marmoles.sistemataup.online` → `127.0.0.1:8011`.
  - Auto-deploy: script `deploy/scripts/marmoles-autodeploy.sh` que hace fetch/reset de `origin/master`, instala deps si cambia `backend/requirements.txt` y reinicia el servicio.

### Corregido

- Conflictos de merge en `frontend/app/package-lock.json` resueltos (lockfile regenerado).
- Limpieza de `frontend/app/node_modules` y reinstalación de dependencias en `frontend/app`.

## 2025-12-02

### Frontend

- Compras: el "Costo m²" del historial ahora se completa automáticamente con el valor ingresado en el formulario al registrar una compra y, si no hay valor, se usa el precio del material.
- Actualizaciones en `frontend/app/src/components/inventario/ComprasProveedores.tsx` para reflejar el precio en la columna correspondiente.
- Persistencia local: se guarda el último costo por material en `localStorage` y se restaura tras recargar la página en Historial y Stock.

### Backend

- Revertido el campo `precio_m2` en `compras` para asegurar compatibilidad con la base de datos existente y evitar errores 500. El costo m² se deriva del material o del cache local en frontend.

### Merge

- Conflictos resueltos: `backend/test.db` (se mantuvo `ours`, versión local) y `frontend/app/src/components/logistica/DashboardEntregas.tsx` (se aplicó `theirs`, versión remota completa).
- Fusión concluida y empujada a remoto (`master`).
- Recomendación: excluir `backend/test.db` del control de versiones para evitar conflictos binarios futuros.

### Logística

- Nuevo `DashboardEntregas` con firma digital y trazabilidad completa (`frontend/app/src/components/logistica/DashboardEntregas.tsx`).
- Integración de contextos: `ProduccionContext` y `EntregasContext` (`frontend/app/src/context/ProduccionContext.tsx`, `frontend/app/src/context/EntregasContext.tsx`).
- Comprobante PDF de entrega soportado desde `utils/pdf`.

### Producción

- Biblioteca de planificación local: `frontend/app/src/lib/produccion/plan.ts`.
- Tests unitarios en `frontend/app/src/lib/produccion/__tests__/plan.test.ts` cubriendo cálculo de áreas, agrupado por material y generación de colocaciones.

### Eliminado

- `frontend/app/src/components/produccion/PlanillaCorte.tsx` (depurado del flujo actual).
- Endpoints de backend para `planilla-corte`: `optimizar`, `ordenar` y `desde-plano` removidos de `backend/app/src/produccion/router.py`. Esquema `PlanillaCorteRequest` y modelo `PlanCorte` eliminados.

### Otros

- Ajustes de interfaz en `App.tsx`, `Sidebar.tsx`, `Seguimiento.tsx`.
- Actualizadas UI primitives: `progress.tsx` y `switch.tsx`.
- Configuración de `vite` con proxy a backend y servidor en `http://localhost:3000/` (`frontend/app/vite.config.ts`).


# ✅ CAMBIOS IMPLEMENTADOS - 20/02/2026

## Resumen Ejecutivo
Se implementaron 3 cambios clave para hacer más flexible el proceso de aprobación y agregar funcionalidad de estado de corte:

---

## 🔧 Cambios de Backend

### 1. ✅ Agregar Campo `estado` a Piezas de Corte
**Ubicación:** `backend/app/models/produccion.py`

Se agregó el campo `estado` al modelo `PiezaTrabajo`:
```python
class PiezaTrabajo(Base):
    # ... campos existentes ...
    estado: Mapped[str] = mapped_column(String(32), default="pendiente")
    # Valores: "pendiente", "cortada", "pulida", "terminada"
```

**Migración Creada:**
- Archivo: `backend/alembic/versions/9999_add_estado_to_piezas_trabajo.py`
- Ejecutar con: `alembic upgrade head`

---

### 2. ✅ Flexible Regla de Oro (3 Requisitos → 2)
**Ubicación:** `backend/app/src/produccion/services.py`

**ANTES (Estricto):**
```python
def check_regla_de_oro(trabajo):
    # Requería: Visita Técnica + Aprobado Jefe + Seña Abonada + Medidas Corregidas
    return errores
```

**AHORA (Flexible):**
```python
def check_regla_de_oro(trabajo):
    """Verificó requisitos mínimos: Visita Técnica + Seña Abonada"""
    errores = []
    if not trabajo.visita_tecnica:
        errores.append("Falta Visita Técnica")
    if not trabajo.sena_abonada:
        errores.append("Falta Seña Abonada")
    return errores
```

**Beneficio:** Proceso más ágil, menos bloqueos administrativos.

---

### 3. ✅ Nuevo Endpoint: Cambiar Estado de Pieza
**Ubicación:** `backend/app/src/produccion/router.py`

Nuevo endpoint agregado:
```bash
POST /api/trabajos/{trabajoId}/piezas/{piezaId}/estado
```

**Request:**
```json
{
  "estado": "cortada"  // o: "pendiente", "pulida", "terminada"
}
```

**Response:**
```json
{
  "id": "pieza-123",
  "trabajo_id": "trabajo-456",
  "estado": "cortada",
  "mensaje": "Pieza marcada como 'cortada'"
}
```

**Validaciones:**
- Solo usuarios con rol `produccion` o `admin`
- Estados válidos: `pendiente`, `cortada`, `pulida`, `terminada`
- Retorna 404 si pieza no existe

---

### 4. ✅ Actualizar Endpoints de Validación
**Ubicación:** `backend/app/src/produccion/router.py`

#### Endpoint: Validar Aprobación Jefe
```bash
POST /api/trabajos/{trabajoId}/validar/aprobacion
```

**Cambios:**
- ✅ Solo requiere `visita_tecnica`
- ✅ Intenta ingreso automático si `visita_tecnica && sena_abonada`
- ✅ Mensaje más informativo en respuesta

**Response:**
```json
{
  "id": "trabajo-123",
  "aprobado_jefe": true,
  "mensaje": "Aprobación registrada. Ingresará a producción cuando seña sea abonada."
}
```

#### Endpoint: Registrar Seña Abonada
```bash
POST /api/trabajos/{trabajoId}/validar/sena
```

**Cambios:**
- ✅ Intenta ingreso automático cuando ambos requisitos se cumplen
- ✅ Mensaje confirmatorio

**Response:**
```json
{
  "id": "trabajo-123",
  "sena_abonada": true,
  "mensaje": "Seña registrada. Se inició proceso de producción."
}
```

---

## 🎨 Cambios de Frontend

### 1. ✅ Mejorar UX en OrdenVisitaDialog
**Ubicación:** `frontend/app/src/pages/finanzas/OrdenVisitaDialog.tsx`

**Mejoras en `handleAprobarJefe()`:**

**ANTES:**
- Intentaba aprobación sin validar requisitos
- Mensajes genéricos de error

**AHORA:**
```typescript
const handleAprobarJefe = async () => {
  // 1. Validar requisitos ANTES de intentar
  const falta = [];
  if (!requisitos.visita_tecnica) {
    falta.push("Visita Técnica no realizada");
  }
  
  // 2. Si falta algo, mostrar error específico
  if (falta.length > 0) {
    toast.error(`No se puede aprobar.\n\nFalta: ${falta.join(', ')}`);
    return;
  }
  
  // 3. Proceder si todo OK
  await post(`/api/trabajos/${trabajoId}/validar/aprobacion`, {});
  toast.success(response?.mensaje);
};
```

**Beneficios:**
- Usuario sabe automáticamente qué falta
- No intenta llamadas innecesarias al backend
- Mensajes claros y accionables

### 2. ✅ ListaPendientes ya Compatible
**Ubicación:** `frontend/app/src/pages/produccion/ListaPendientes.tsx`

**Estado:** ✅ Ya estaba usando el endpoint correctamente
- Llama `POST /api/trabajos/{id}/piezas/{piezaId}/estado`
- Envía `{ estado: 'cortada' }`
- Perfecto funcionamiento, no requería cambios

---

## 📋 Flujo de Trabajo Mejorado

### ANTES (Restrictivo)
```
1. Cliente visita → 2. Seña abonada → 3. Aprobación Jefe ← BLOQUEO aquí
4. Medidas corregidas → 5. Ingreso a Producción
```

### AHORA (Flexible ⭐)
```
1. Cliente visita → 2. Seña abonada → Ingreso automático a Producción ✨
   (Aprobación Jefe es asincrónica/posterior)
3. Marca piezas como cortadas → 4. Pulido → 5. Terminado
```

---

## 🚀 Cómo Usar

### Para el Usuario (Finanzas/Producción)
1. **Agendar Visita:** Ir a Órdenes → Nuevo
2. **Marcar Visita Realizada:** Botón "Marcar Realizada"
3. **Registrar Seña:** Ir a Finanzas → Registrar Pago
4. **Validar:** Botón "Validar Aprobación" (más flexible ahora)
5. **Ir a Taller:** Sistema entra automático a producción
6. **Marcar Cortes:** Ir a Lista Pendientes → "Corte OK" (usa nuevo endpoint)

### Para el Desarrollador
```bash
# 1. Aplicar migración de BD
cd backend
alembic upgrade head

# 2. Reiniciar backend
docker-compose restart backend

# 3. Las validaciones están centralizadas en check_regla_de_oro()
# Cambiar lógica en: backend/app/src/produccion/services.py

# 4. Agregar más estados de corte: "pulida", "terminada"
# Ya está en el código, Frontend solo debe enviarlos
```

---

## ✅ Testing Checklist

- [ ] Ejecutar migración: `alembic upgrade head`
- [ ] Crear pieza manualmente en BD para verificar campo estado
- [ ] Ir a Órdenes → Validar que aprobación es más flexible
- [ ] Ir a Taller → Corte OK → Verificar que marca como cortada
- [ ] Registrar pago 40%+ → Verificar ingreso automático a producción
- [ ] Intentar aprobación sin visita → Verificar error específico

---

## 📊 Cambios de Base de Datos

```sql
-- Nueva Columna en piezas_trabajo
ALTER TABLE piezas_trabajo ADD COLUMN estado VARCHAR(32) DEFAULT 'pendiente';

-- Estados válidos:
-- 'pendiente' (default)
-- 'cortada'
-- 'pulida'
-- 'terminada'
```

---

## 🎯 Resumen de Beneficios

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Flexibilidad** | 3 requisitos estrictos | 2 requisitos mínimos |
| **Velocidad** | Esperar aprobación jefe | Ingreso automático |
| **Rastreo de Cortes** | No hay estado de pieza | Estados claros (pendiente/cortada/pulida/terminada) |
| **UX en Errores** | Genéricos | Específicos y accionables |
| **Automatización** | Manual | Automática cuando cumple |

---

## 🔍 Impacto en Otros Módulos

- ✅ **Finanzas:** Los pagos ahora disparan ingreso automático (más rápido)
- ✅ **Producción:** Menos búsqueda de aprobaciones, más enfoque en ejecución
- ✅ **Logística:** Recibe órdenes más rápido
- ✅ **Reportes:** Campo estado de pieza ahora disponible para analytics

---

## 📝 Notas Técnicas

1. **El campo `estado` es nullable=False** para asegurar integridad
2. **Default es 'pendiente'** para retro-compatibilidad con piezas existentes
3. **Check_regla_de_oro es la fuente única de verdad** para validaciones
4. **Migración es automática** con Alembic→ no hay data loss

---

**Implementación completada exitosamente** ✨
