---
---

# Agentes Disponibles - Marmoles IMA

Este documento describe todos los agentes especializados disponibles en el workspace. Usa el selector de agentes en chat (arriba a la izquierda) para elegir el más apropiado para tu tarea.

## Cuadro Rápido de Decisión

```
¿Qué necesitas?
├─ Stock, lotes, compras, demanda, sincronización
│  └─ → Stock Reception & Inventory
├─ Precios, márgenes, presupuestos, rentabilidad
│  └─ → Costs & Financial Logic
├─ Producción, entregas, tareas, logística
│  └─ → Operations & Fulfillment
├─ API, frontend/backend sync, data contracts
│  └─ → Backend-Frontend Integration
└─ Integridad de datos, auditoría, root cause
   └─ → Data Quality & Auditing
```

---

## Agente 1: Stock Reception & Inventory

**Experto en:** Recepción de materiales, gestión de lotes, compras, demanda, sincronización de stock.

### Cuándo usarlo

- Stock físico ≠ stock en sistema
- Lotes huérfanos (sin compras) o compras sin piezas
- Demanda no reconciliada con compras
- Necesito auditar quién recibió qué cuando
- Calcular stock disponible vs. comprometido

### Ejemplo de prompt

```
"El cliente ABC dice que pidió 200 placas hace 2 semanas pero el sistema solo muestra 50 disponibles.
Audita qué compras se crearon, qué piezas llegaron, y dónde están los 150 faltantes."
```

### Archivos típicos que toca

- Backend: `routers/inventario.py`, `models/lote.py`, `models/compra.py`
- DB: migrations para `piezas`, `lotes`, `compras`, `demanda`
- Scripts: `scripts/verify_*.py`, `scripts/check_*.py`

---

## Agente 2: Costs & Financial Logic

**Experto en:** Cálculo de costos, márgenes, precios, presupuestos, rentabilidad.

### Cuándo usarlo

- ¿Cuál es mi ganancia en un presupuesto?
- Costo de material subió → necesito reajustar precios
- Comparar precio vendido vs. costo real de producción
- Generar reporte de márgenes por producto/cliente
- Una cotización no incluye toda la mano de obra

### Ejemplo de prompt

```
"Client XYZ presupuesto se cotizó en $10,000 pero cost sheet muestra $8,500 en materiales + $800 en labor.
¿Dónde está el error en el margen? ¿Cómo recalcularíamos el precio?"
```

### Archivos típicos que toca

- Backend: `routers/finanzas.py`, `models/presupuesto.py`, `models/costos.py`
- DB: migrations para `costos`, `presupuestos`, `lineas_presupuesto`
- Scripts: `scripts/verify_profit.py`, cost analysis

---

## Agente 3: Operations & Fulfillment

**Experto en:** Producción, entregas, tareas, logística, estado de lotes.

### Cuándo usarlo

- ¿En qué estado está un lote? (recibido, procesando, listos, archivados)
- Mover un lote/pieza de un estado a otro
- Preparar un paquete de entrega para cliente
- Rastrear delivery: cuándo se envió, en ruta, entregado
- ¿Qué tareas están pendientes en este lote?

### Ejemplo de prompt

```
"Lote #2847 tiene 500 piezas listas. Quiero crear un envío para el cliente 'Mármoles del Centro'
con 300 unidades de tipo 'Rosa', revisar si tengo stock, preparar documentos de despacho."
```

### Archivos típicos que toca

- Backend: `routers/produccion.py`, `routers/logistica.py`, `models/entrega.py`
- DB: migrations para `entregas`, `piezas_trabajo`, `tareas`
- Frontend: Delivery tracking views

---

## Agente 4: Backend-Frontend Integration

**Experto en:** APIs, sincronización de datos, data contracts, conversión frontend-backend.

### Cuándo usarlo

- Frontend muestra un dato que la BD dice es diferente
- API devuelve formato inesperado vs. lo que frontend espera
- Agrego un campo en la BD pero frontend no lo ve
- Endpoint es lento o no devuelve toda la data
- Documentar "qué espera frontend de cada API"

### Ejemplo de prompt

```
"El componente StockDisplay muestra 500 piezas pero la API /inventario/stock devuelve 450.
Tracear dónde se pierde la sincronización: ¿es query incorrecta, API not updated, o frontend cache stale?"
```

### Archivos típicos que toca

- Backend: `routers/*.py`, SQLAlchemy queries
- Frontend: `src/hooks/useStockFetch.ts`, `src/api/client.ts`
- Schema: FastAPI schemas, TypeScript interfaces

---

## Agente 5: Data Quality & Auditing

**Experto en:** Integridad de datos, invariantes, auditoría, root cause analysis.

### Cuándo usarlo

- Sospecha que hay datos corruptos o inconsistentes
- "¿Hay piezas que aparecen en dos lotes simultáneamente?"
- Stock total ≠ suma de piezas disponibles
- Auditar quién hizo un cambio y cuándo
- Validar que todas las entregas corresponden a presupuestos

### Ejemplo de prompt

```
"Corre integrity check: ¿hay lotes sin compras? ¿Hay piezas huérfanas?
¿Stock = suma de disponibles? Reparar si lo encuentras y dame log de qué arreglaste."
```

### Archivos típicos que toca

- Backend: scripts de auditoría, `check_*.py`, migraciones
- DB: queries de integridad, logs de auditoría
- Documentation: invariantes, reglas de negocio

---

## Matriz de Responsabilidades

| Tarea                        | Agente                       | Razón                              |
| ---------------------------- | ---------------------------- | ---------------------------------- |
| "Stock no cuadra"            | Stock Reception              | Es investigar lotes/compras/piezas |
| "¿Cuánta ganancia?"          | Costs & Financial            | Requiere cálculo de márgenes       |
| "Preparar entrega"           | Operations                   | Fulfill order workflow             |
| "API devuelve lo incorrecto" | Backend-Frontend Integration | Contrato, schema, sincronización   |
| "Datos corruptos"            | Data Quality                 | Integridad, auditoría, root cause  |

---

## Cómo Invocar un Agente

### Opción 1: Selector Manual

1. Click en el área de chat arriba ("Copilot de GitHub")
2. Selecciona el agente por nombre
3. Escribe tu pregunta

### Opción 2: Automático por Contexto

- Describe tu problema normalmente
- El sistema detecta qué agente es relevante y lo invoca
- Ej: "Stock muestra 500..." → Stock Reception invoked automáticamente

### Opción 3: Slash Command

- Tipo `/` en chat para abrir comando rápido
- Busca por nombre del agente
- Escribe prompt e invoca

---

## Mejores Prácticas

### ✅ Qué hacer

- **Sé específico**: "Stock muestra X pero tenemos Y" es mejor que "stock está roto"
- **Da contexto**: Cliente, lote, fecha, cantidad involucrada
- **Pregunta claro**: "¿Por qué?" o "¿Cómo arreglo?"
- **Sigue la evidencia**: El agente te pedirá queries, logs, antes/después

### ❌ Qué evitar

- Cambios globales sin revisar dependencias
- Asumir que el agente va a "simplemente arreglarlo"
- No revisar invariantes después de un cambio
- Ignorar warnings o riesgos que el agente reporta

---

## Flujo Típico

```
1. Reportas un problema en chat
   ↓
2. Sistema detecta qué dominio toca
   ↓
3. Agente correspondiente es invocado
   ↓
4. Agente pregunta contexto (quién reportó, impacto, urgencia)
   ↓
5. Agente inspecciona: DB, logs, API responses
   ↓
6. Agente reporta root cause + aprobación de fix
   ↓
7. Agente ejecuta fix con auditoría
   ↓
8. Agente valida invariantes, show before/after
   ↓
9. Resultado: artefactos (código, migraciones, pruebas)
```

---

## Escalamiento

Si un problema cruza múltiples dominios (Ej: presupuesto → stock → entregas → finanzas):

1. El agente de "entrada" (Stock Reception) lo detecta
2. Delega a otros agentes (Operations, Costs) según necesidad
3. Coordina y reporta al final un summary integrado

No necesitas invocar todos manualmente. El sistema coordina.

---

**¿Necesitas ayuda?**  
Describe tu problema y el agente apropiado aparecerá. Si no estás seguro cuál elegir, usa el cuadro de decisión arriba.
