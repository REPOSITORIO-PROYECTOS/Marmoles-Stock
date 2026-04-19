---
description: "Workspace-wide instructions for marmoles_muestra project. Applies to all work unless a more specific instruction overrides."
---

# Guía de Trabajo - Proyecto Marmoles IMA

Este documento establece los principios, convenciones y flujo de trabajo para mantener la integridad arquitectónica del proyecto.

## 🎯 Principios Fundamentales

1. **Separación por Dominios**  
   La API está dividida en módulos por dominio (auth, crm, inventario, producción, finanzas, etc.). Los cambios en un dominio pueden impactar en adyacentes. Siempre verifica dependencias cruzadas antes de tocar modelos o queries.

2. **Base de Datos es Fuente de Verdad**
   - La schema se define ÚNICAMENTE con Alembic, nunca scripts manuales.
   - Frontend espeja el estado del backend; nunca asumir caché local es correcto.
   - Todas las queries críticas deben validarse contra la DB actual, no en memoria.

3. **Auditoría y Trazabilidad**
   - Todo cambio en stock, dinero, cliente o estado crítico debe quedar logueado.
   - Preserve historia: marca como `archivado`, no elimines.
   - Cada migración debe incluir `ALTER TABLE ... ADD COLUMN audit_*` si toca datos sensibles.

4. **Validación en Dos Capas**
   - Backend: Validación fuerte (reglas de negocio, constraints).
   - Frontend: Validación operativa (UX, feedback inmediato).
   - Nunca confíes en solo frontend; siempre valida en backend.

5. **Data Contracts Explícitos**
   - Toda API endpoint debe documentar: request shape, response shape, status codes, errores.
   - Si cambias un endpoint, busca all consumers antes de tocar la forma.

---

## 🤖 Equipo de Agentes Especializados

Usa el agente correcto según lo que estés resolviendo. Invoke manualmente o el sistema puede delegarte automáticamente.

| Agente                           | Cuándo                                        | Ejemplo                                                  |
| -------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| **Stock Reception & Inventory**  | Lotes, compras, demanda, stock sync           | "Stock muestra 500 pero tenemos 200", "Lote huérfano"    |
| **Costs & Financial Logic**      | Precios, márgenes, presupuestos, rentabilidad | "¿Cuál es la ganancia?", "Recalcular precios"            |
| **Operations & Fulfillment**     | Producción, entregas, tareas, logística       | "Mover lote a listos", "Rastrear entrega"                |
| **Backend-Frontend Integration** | APIs, sincronización, data contracts          | "Frontend muestra dato viejo", "Documentar contrato API" |
| **Data Quality & Auditing**      | Integridad, auditoría, root cause             | "Dato corrompido", "Verificar invariantes"               |

---

## 📋 Checklist Pre-Cambio

Antes de tocar código, responde esto:

- [ ] **¿Cuál es la fuente de verdad?**  
      ¿Qué tabla, query o cálculo gobierna este dato?

- [ ] **¿Quién puede modificarlo?**  
      ¿Hay restricción de permisos? ¿Requiere aprobación?

- [ ] **¿Qué impacto cruzado hay?**  
      Revisa ARQUITECTURA.md. ¿Qué otros dominios consumen este dato?

- [ ] **¿Cómo se audita?**  
      ¿Qué queda logueado? ¿Quién, cuándo, qué cambió, valor anterior?

- [ ] **¿Cuál es el roll-back plan?**  
      ¿Puedes revertir sin perder datos o rompiendo clientes?

- [ ] **¿Se necesita migración?**  
      Si toca schema.py o models, requiere migration de Alembic.

---

## 🔄 Flujo de Cambios Recomendado

### Paso 1: Diagnóstico

```
Quién:     El que reporta + especialista del área
Qué:       Entender qué está roto, cuál es el síntoma, cuál el impacto
Dónde:     Diagrama en ARQUITECTURA.md, inspeccionar tablas actuales
Resultado: Documento con: problema, síntoma, impacto, usuario afectado
```

### Paso 2: Análisis de Raíz

```
Quién:     Data Quality & Auditing agent o especialista técnico
Qué:       Encontrar por qué está roto (UI bug, sync fallo, data corruption)
Dónde:     Backend logs, queries, API responses, frontend state
Resultado: Root cause documentada + invariante violada identificada
```

### Paso 3: Diseño de Solución

```
Quién:     Arquitecto (Cursor en modo arquitecto)
Qué:       Proponer fix que toque la capa correcta, preserve auditoría, no rompa dependencias
Dónde:     Schema si toca DB, query si toca data, endpoint si toca API
Resultado: Plan con: archivos a tocar, riesgos, rollback
```

### Paso 4: Implementación

```
Quién:     Especialista del dominio (agent o dev)
Qué:       Ejecutar cambios con evidencia (build, tests, antes/después)
Dónde:     Backend: alembic + query + test, Frontend: component + hook + test
Resultado: Cambios mergeables, documentados, con invariantes validadas
```

### Paso 5: Validación

```
Quién:     QA + especialista del dominio
Qué:       Verificar que el cambio resolvió el problema sin romper nada
Dónde:     Casos de uso: feliz, borde, inválido
Resultado: Test evidence, antes/después, riesgos remanentes documentados
```

---

## 🚨 Dependencias Críticas a Vigilar

Cuando toques estos, AUDITA los otros:

| Si modificas...       | Revisa también...        | Razón                             |
| --------------------- | ------------------------ | --------------------------------- |
| `presupuestos` modelo | `produccion`, `finanzas` | Presupuesto impulsa ambas         |
| `inventario` stock    | `produccion` consumo     | Stock se reserva al producir      |
| `piezas` estado       | `entregas` fulfillment   | Entrega depende de piezas listos  |
| `compras` cantidad    | `stock` total            | Compra causa aumento de stock     |
| `tareas` completadas  | `entregas` auditoría     | Tarea completa → pieza disponible |

---

## 📝 Convenciones de Código

### Backend (FastAPI + SQLAlchemy)

**Migraciones:**

```python
# Cada cambio schema → alembic revision -m "descripcion_clara"
# Ej: alembic revision -m "add_audit_timestamp_to_piezas"
# La migration DEBE tener upgrade() y downgrade()
```

**Modelos:**

```python
# Siempre include campos de auditoría:
class Pieza(Base):
    id = Column(Integer, primary_key=True)
    lote_id = Column(Integer, ForeignKey("lote.id"), nullable=False)  # FK obligatory
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    archived_at = Column(DateTime, nullable=True)  # Soft delete
```

**Queries:**

```python
# Siempre verificar: FK existence, soft deletes, ordering
piezas = db.query(Pieza).filter(
    Pieza.lote_id == lote_id,
    Pieza.archived_at.is_(None)  # Excluir archivados
).order_by(Pieza.created_at).all()
```

**Endpoints:**

```python
# 1. Docstring breve
# 2. Request schema explícita
# 3. Response schema explícita
# 4. Status codes documentados
# 5. Error handling con detalle

@router.post("/lotes/{lote_id}/piezas", response_model=PiezaResponse)
def crear_pieza(lote_id: int, req: PiezaRequest):
    """
    Crear una pieza en un lote.

    - 201: Pieza creada
    - 404: Lote no existe
    - 400: Cantidad inválida
    """
```

### Frontend (React + TypeScript)

**Components:**

```typescript
// 1. Tipado fuerte (no any)
// 2. Props documentadas
// 3. Effect clarity (qué gatilla, qué limpia)
interface StockDisplayProps {
  loteId: string; // ID from API
  onUpdate: (stock: number) => void;
}

export function StockDisplay({ loteId, onUpdate }: StockDisplayProps) {
  // Siempre fetch from backend, never assume cache
  const [stock, setStock] = useState<number | null>(null);

  useEffect(() => {
    fetchStockFromAPI(loteId).then(setStock);
  }, [loteId]);
}
```

**API Calls:**

```typescript
// 1. Documentar contrato (request/response shape)
// 2. Error handling explícita
// 3. Link a endpoint documentation

interface StockResponse {
  lote_id: string;
  cantidad_total: number;
  cantidad_disponible: number;
}

async function fetchStockFromAPI(loteId: string): Promise<StockResponse> {
  const res = await fetch(`/api/inventario/lotes/${loteId}/stock`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

---

## ✅ Checklist de Merge / Commit

Antes de pushear, verifica:

- [ ] **Código compila/no hay errores de sintaxis**
- [ ] **Tests pasan** (si existen)
- [ ] **Invariantes documentadas** (si toca datos sensibles)
- [ ] **Auditoría queda logueada** (si modifica stock, dinero, cliente)
- [ ] **Endpoints documentados** (si es API change)
- [ ] **Migraciones reversibles** (si toca schema)
- [ ] **Dependencias revisadas** (según tabla arriba)
- [ ] **Frontend/Backend sincronizados** (si cross-layer)
- [ ] **SIN breaking changes** (o versionado explícitamente)

---

## 🆘 Si Algo Sale Mal

1. **No entres en pánico**. Los datos están en DB, todo es auditable.
2. **Identifica el dominio**: ¿Qué agente debería intervenir?
3. **Revoca rápido**: Rollback de migration, revert de commit, restore de backup.
4. **Investiga**: ¿Por qué pasó? ¿Qué invariante saltamos?
5. **Documenta**: Post-mortem, prevención, mejora de checklist.

**Contactos por dominio:**

- Stock/Inventario → Stock Reception & Inventory agent
- Finanzas → Costs & Financial agent
- Producción → Operations & Fulfillment agent
- API sync → Backend-Frontend Integration agent
- Datos rotos → Data Quality & Auditing agent

---

## 📚 Referencia de Arquitectura

Ver archivo `context/ARQUITECTURA.md` para:

- Stack completo
- Mapa de módulos backend
- Dependencias cruzadas específicas
- Riesgos conocidos y deuda técnica

---

**Última actualización:** Abril 2026  
**Versión de arquitectura:** 1.0 (FastAPI + React, 3 servicios Docker)  
**Próxima revisión:** Cuando se agregue un nuevo dominio o se cambien puertos
