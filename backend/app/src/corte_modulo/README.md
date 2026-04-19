# Corte Módulo

## Estructura
- `backend/`: lógica de optimización y planificación.
- `utils/`: validación, errores y DTOs.
- `tests/`: pruebas unitarias.

## Integración
- Backend expone `optimize_rect` y `CuttingPlanner` en `backend/optimizer.py`.
- Producción usa validaciones en `utils/validation.py` y formatea la salida con `utils/dto.py`.

## Datos
- Soporta múltiples piezas con `qty` por selección.
- Sanitiza y valida tableros, piezas y `trims`.

## Comunicación
- El cliente envía `width`, `height`, `kerf`, `trims` y `piezas`.
- Backend responde con `placements`, `cuts`, `effective_board` y métricas.

## Pruebas
- `tests/test_optimizer.py` cubre casos básicos.
- `tests/test_validation.py` verifica validaciones.

## Uso
- Importar `optimize_rect` desde `corte_modulo.backend.optimizer`.
- En GUI, usar `CuttingPlanner` para interactuar.
