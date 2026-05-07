/** Modelo de UI: ambiente → piezas → extras; productos adicionales aparte (Sprint 7). */

import {
  formatLargoAnchoMLineaMedida,
  parseMedidasDimensionMetros,
} from '../utils/presupuestoRenderer';

export { formatLargoAnchoMLineaMedida } from '../utils/presupuestoRenderer';

const TOL_M2 = (m: number) => Math.max(1e-4, Math.abs(m) * 1e-6);

/**
 * Tras fijar largo×ancho, conserva solo lo que en «Nota / medidas libres» no es la dimensión
 * (o tramo con `·`) o descarta texto de dimensiones obsoleto.
 */
export function notaTrasSincroDimensiones(medidasTrim: string, m2Unit: number): string {
  const t = String(medidasTrim || '').trim();
  if (!t) return '';
  const parts = t.split('·');
  const first = parts[0]?.trim() ?? '';
  const rest = parts.slice(1).join('·').trim();
  const d = parseMedidasDimensionMetros(first);
  if (d) {
    const p = d.largo_m * d.ancho_m;
    if (Math.abs(p - m2Unit) <= TOL_M2(m2Unit)) {
      return rest;
    }
    if (rest) return rest;
    return '';
  }
  return t;
}

export type ExtraEnPieza = {
  id: string;
  servicio_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type PiezaPresupuesto = {
  id: string;
  material_id: string;
  material_nombre: string;
  precio_m2: number;
  /** m² efectivo para API: automático si hay largo×ancho, si no el valor manual/legacy */
  m2: number;
  /** Largo en metros (opcional; con ancho define m²) */
  largo_m: number;
  /** Ancho en metros (opcional; con largo define m²) */
  ancho_m: number;
  /** Cantidad de piezas iguales (misma medida / mismo m² unitario); default 1 */
  cantidad_piezas: number;
  medidas: string;
  lote_id?: string;
  geometria_json?: string;
  extras: ExtraEnPieza[];
};

export type AmbientePresupuesto = {
  id: string;
  nombre: string;
  piezas: PiezaPresupuesto[];
};

export type ProductoAdicionalLinea = {
  id: string;
  producto_id?: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export function nuevoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ambienteVacio(nombre?: string): AmbientePresupuesto {
  return { id: nuevoId(), nombre: nombre || 'Ambiente', piezas: [] };
}

export function piezaVacia(): PiezaPresupuesto {
  return {
    id: nuevoId(),
    material_id: '',
    material_nombre: '',
    precio_m2: 0,
    m2: 0,
    largo_m: 0,
    ancho_m: 0,
    medidas: '',
    cantidad_piezas: 1,
    extras: [],
  };
}

/** m² = largo × ancho si ambos > 0; si no, usa `m2` (manual o línea cargada). */
export function metrosCuadradosPieza(p: PiezaPresupuesto): number {
  const L = Number(p.largo_m) || 0;
  const W = Number(p.ancho_m) || 0;
  if (L > 0 && W > 0) return L * W;
  return Math.max(0, Number(p.m2) || 0);
}

/** Piezas iguales a facturar (entero ≥ 1). */
export function cantidadPiezasValida(p: PiezaPresupuesto): number {
  const n = Math.floor(Number(p.cantidad_piezas) || 1);
  return Math.max(1, Math.min(9999, n));
}

/** m² totales = m² por pieza × cantidad de piezas. */
export function metrosCuadradosTotalesPieza(p: PiezaPresupuesto): number {
  return metrosCuadradosPieza(p) * cantidadPiezasValida(p);
}

export function subtotalMaterialPieza(p: PiezaPresupuesto): number {
  return metrosCuadradosTotalesPieza(p) * (Number(p.precio_m2) || 0);
}

/** Línea API (GET presupuesto) → árbol UI */
export function ambientesDesdeLineas(
  lineas: Array<Record<string, unknown>>,
): AmbientePresupuesto[] {
  if (!lineas?.length) return [ambienteVacio('General')];
  const amb = ambienteVacio('General');
  let piezaActual: PiezaPresupuesto | null = null;
  for (const raw of lineas) {
    const tipo = String(raw.tipo || 'material');
    if (tipo === 'material') {
      const m2Line = Number(raw.metros_cuadrados || 0);
      const cantApi = raw.cantidad != null ? Number(raw.cantidad) : NaN;
      const enteroPiezas =
        Number.isFinite(cantApi) && cantApi >= 1 && Math.abs(cantApi - Math.round(cantApi)) < 1e-6
          ? Math.max(1, Math.min(9999, Math.round(cantApi)))
          : null;
      const piezasDesdeMedidas = (): number | null => {
        const med = String(raw.medidas || '');
        let m = /^\s*(\d+)\s*piezas\s*[×x]/i.exec(med);
        if (m) return Math.max(1, parseInt(m[1], 10));
        m = /^\s*(\d+)\s*piezas\b/i.exec(med);
        if (m) return Math.max(1, parseInt(m[1], 10));
        return null;
      };
      const q = enteroPiezas ?? piezasDesdeMedidas() ?? 1;
      const m2Unit = q > 1 && m2Line > 0 ? m2Line / q : m2Line;
      const medStr = String(raw.medidas || '').trim();
      const dimPart = medStr.split('·')[0]?.trim() ?? medStr;
      let largo_m = 0;
      let ancho_m = 0;
      if (m2Unit > 0) {
        const dp = parseMedidasDimensionMetros(dimPart) || parseMedidasDimensionMetros(medStr);
        if (dp) {
          const prod = dp.largo_m * dp.ancho_m;
          const tol = Math.max(0.02, m2Unit * 1e-4);
          if (Math.abs(prod - m2Unit) <= tol) {
            largo_m = dp.largo_m;
            ancho_m = dp.ancho_m;
          }
        }
      }
      piezaActual = {
        id: nuevoId(),
        material_id: String(raw.material_id || ''),
        material_nombre: String(raw.material || ''),
        precio_m2: Number(raw.precio_unitario || 0),
        m2: m2Unit,
        largo_m,
        ancho_m,
        medidas: medStr,
        lote_id: raw.lote_id ? String(raw.lote_id) : undefined,
        geometria_json: raw.geometria_json ? String(raw.geometria_json) : undefined,
        cantidad_piezas: q,
        extras: [],
      };
      amb.piezas.push(piezaActual);
    } else if (tipo === 'extra' && piezaActual) {
      piezaActual.extras.push({
        id: nuevoId(),
        servicio_id: String(raw.servicio_id || ''),
        nombre: String(raw.material || 'Extra'),
        precio: Number(raw.precio_unitario || 0),
        cantidad: Number(raw.cantidad ?? 1),
      });
    }
  }
  if (amb.piezas.length === 0) return [ambienteVacio('General')];
  return [amb];
}

/** Payload `lineas` para POST /api/presupuestos */
export function lineasApiDesdeAmbientes(ambientes: AmbientePresupuesto[]) {
  const out: Record<string, unknown>[] = [];
  for (const amb of ambientes) {
    for (const p of amb.piezas) {
      const m2Unit = metrosCuadradosPieza(p);
      const q = cantidadPiezasValida(p);
      if (!p.material_id || !p.material_nombre || m2Unit <= 0) continue;
      const m2Tot = m2Unit * q;
      const medidasTrim = (p.medidas || '').trim();
      const dimsLinea =
        p.largo_m > 0 && p.ancho_m > 0
          ? formatLargoAnchoMLineaMedida(p.largo_m, p.ancho_m)
          : '';
      const notaLibre = notaTrasSincroDimensiones(medidasTrim, m2Unit);
      const medidasApi = (() => {
        if (p.largo_m > 0 && p.ancho_m > 0 && dimsLinea) {
          const core =
            q > 1
              ? `${dimsLinea} · ${q} piezas × ${m2Unit} m² c/u (${m2Tot} m² total)`
              : dimsLinea;
          if (notaLibre) return `${core} · ${notaLibre}`;
          return core;
        }
        if (medidasTrim) return medidasTrim;
        if (q > 1) {
          return dimsLinea
            ? `${dimsLinea} · ${q} piezas × ${m2Unit} m² c/u (${m2Tot} m² total)`
            : `${q} piezas × ${m2Unit} m² c/u (${m2Tot} m² total)`;
        }
        return dimsLinea;
      })();
      out.push({
        tipo: 'material',
        material_id: p.material_id,
        material: p.material_nombre,
        metros_cuadrados: m2Tot,
        /** Número de piezas (el PDF y el stock usan m² totales en metros_cuadrados). */
        cantidad: q,
        medidas: medidasApi,
        precio_unitario: p.precio_m2,
        unidad: 'm²',
        lote_id: p.lote_id || undefined,
        geometria_json: p.geometria_json,
        cortes_especiales: false,
        agujeros: 0,
        recargo_extra: 0,
      });
      for (const ex of p.extras) {
        if (!ex.servicio_id) continue;
        out.push({
          tipo: 'extra',
          servicio_id: ex.servicio_id,
          material: ex.nombre,
          metros_cuadrados: 1,
          unidad: 'unidad',
          cantidad: ex.cantidad,
          precio_unitario: ex.precio,
          cortes_especiales: false,
          agujeros: 0,
          recargo_extra: 0,
        });
      }
    }
  }
  return out;
}
