# Integración Front para Plan de Corte

## Solicitudes
- Optimizar planilla de corte:
  - Body: `{ width, height, kerf, trims:{left,right,top,bottom}, piezas:[{ w,h,qty, nota?, holes?:[{x,y,diametro}], corner_cut?:{posicion,size_w,size_h} }] }`
- Planificar plancha desde trabajos:
  - Body: `{ width, height, kerf, trims, material_id, placa_id?, trabajo_ids:[...] }`
- Planificar desde presupuesto por material:
  - Params/Body: `{ presupuesto_id, material_id, width, height, kerf, trims? }`
- Agregar pieza y devolver plan:
  - Route: `/api/trabajos/{trabajoId}/piezas/planificar`
  - Body: `{ w,h,qty }`, Query: `width,height,kerf,trims?`

## Respuestas
- Todas las planificaciones devuelven:
  - `effective_board:{ width,height }`
  - `placements:[{ x,y,w,h }]`
  - `cuts:[{ orientation,x0,y0,x1,y1,bevel }]`
  - `used_area:number`, `utilization:number`
  - `material:{ id,nombre,precio_m2,espesor_mm,color }` en planificación de plancha
  - `piezas_origen:[{ trabajo_id }]`
  - `features:[ { type:"corner_cut"|"hole"|"note", ... } ]` en optimización directa
  - `retazos:[{ x,y,w,h }]`

## Visualización
- Tablero:
  - Dibuja `effective_board` como rectángulo base.
- Piezas:
  - Renderiza `placements` como rectángulos; usa color por trabajo o por índice.
- Cortes:
  - Renderiza `cuts` como líneas; `orientation` indica vertical u horizontal.
- Features especiales:
  - `corner_cut` pinta marca en la esquina indicada con tamaño `size_w x size_h`.
  - `hole` pinta círculo en `x,y` con `diametro`.
  - `note` muestra etiqueta cercana.
- Retazos:
  - Muestra `retazos` semitransparentes; el backend persiste aquellos rectangulares con tamaño ≥ `20x10 cm`.

## Agrupación por Material
- Para unir piezas del mismo material:
  - Usa `/api/produccion/plancha/planificar/desde-presupuesto` con `presupuesto_id` y `material_id`.
  - O pasa múltiples `trabajo_ids` en `/api/produccion/plancha/planificar`.

## Stock
- Planchas:
  - Crear/listar/actualizar en `/api/placas`.
- Retazos:
  - Listar/actualizar/vender en `/api/inventario/retazos`.

## Presupuestos con Recargos
- Enviar `cortes_especiales`, `agujeros` y `recargo_extra` por línea.
- El total se calcula como `sum(m2*precio_unitario + recargo_extra)`.

## Notas
- Unidades: cm en todas las medidas.
- `trims` aplica desplazamiento a `placements` y `cuts`.
