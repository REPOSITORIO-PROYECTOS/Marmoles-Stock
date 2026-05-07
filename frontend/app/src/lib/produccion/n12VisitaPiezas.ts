/** Helpers to sync presupuesto / DXF geometry into N12 VisitaPieza (mm). */

export type VisitaPiezaBulkItem = {
  visita_id: string;
  nombre_pieza: string;
  tipo_pieza?: string;
  largo_mm: number;
  ancho_mm: number;
  espesor_mm?: number | null;
  tipo_forma?: string;
  material_tipo?: string | null;
  color?: string | null;
  acabado?: string | null;
  cantidad?: number;
  observaciones_tecnicas?: string | null;
};

export function dimToMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value < 1000 ? Math.round(value * 10) : Math.round(value);
}

function parseMedidasTexto(medidas: string | undefined): { a: number; b: number } | null {
  if (!medidas || !medidas.trim()) return null;
  const normalized = medidas.replace(/,/g, ".").trim();
  const m = normalized.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
  return { a, b };
}

function espesorDefaultDesdeLinea(linea: Record<string, unknown>): number | null {
  const raw = linea.medidas;
  if (typeof raw === "string") {
    const mm = raw.match(/(\d+)\s*mm/i);
    if (mm) return Math.max(1, parseInt(mm[1], 10));
  }
  return null;
}

export function buildPiezasFromPresupuesto(
  presupuesto: { lineas?: Array<Record<string, unknown>> } | null | undefined,
  visitaId: string,
  materialFallback: string,
): VisitaPiezaBulkItem[] {
  const lineas = Array.isArray(presupuesto?.lineas) ? presupuesto!.lineas! : [];
  const out: VisitaPiezaBulkItem[] = [];
  let idx = 0;

  for (const linea of lineas) {
    const materialRaw = linea.material;
    const materialTipo =
      typeof materialRaw === "string" && materialRaw.trim() ? materialRaw.trim() : materialFallback;
    const espesorLinea = espesorDefaultDesdeLinea(linea);
    const color = typeof linea.color === "string" ? linea.color : undefined;

    const geoRaw = linea.geometria_json;
    if (typeof geoRaw === "string" && geoRaw.trim()) {
      try {
        const geo = JSON.parse(geoRaw) as {
          placements?: Array<{ w?: number; h?: number; width?: number; height?: number; qty?: number }>;
        };
        const placements = Array.isArray(geo?.placements) ? geo.placements : [];
        for (const pl of placements) {
          const w = Number(pl.w ?? pl.width ?? 0);
          const h = Number(pl.h ?? pl.height ?? 0);
          if (w <= 0 || h <= 0) continue;
          const wMm = dimToMm(w);
          const hMm = dimToMm(h);
          if (wMm <= 0 || hMm <= 0) continue;
          const largo = Math.max(wMm, hMm);
          const ancho = Math.min(wMm, hMm);
          const qty = Math.max(1, Math.round(Number(pl.qty ?? 1)));
          idx += 1;
          out.push({
            visita_id: visitaId,
            nombre_pieza: `${materialTipo} · pieza ${idx}`,
            tipo_pieza: "principal",
            largo_mm: largo,
            ancho_mm: ancho,
            espesor_mm: espesorLinea ?? undefined,
            tipo_forma: "rectangular",
            material_tipo: materialTipo,
            color: color ?? undefined,
            cantidad: qty,
          });
        }
      } catch {
        /* ignore malformed json */
      }
    }

    const medidasStr = typeof linea.medidas === "string" ? linea.medidas : undefined;
    const parsed = parseMedidasTexto(medidasStr);
    if (parsed) {
      const wMm = dimToMm(parsed.a);
      const hMm = dimToMm(parsed.b);
      if (wMm > 0 && hMm > 0) {
        const largo = Math.max(wMm, hMm);
        const ancho = Math.min(wMm, hMm);
        const cantidad = Math.max(1, Math.round(Number(linea.cantidad ?? 1)));
        idx += 1;
        out.push({
          visita_id: visitaId,
          nombre_pieza: `${materialTipo} · corte ${idx}`,
          tipo_pieza: "principal",
          largo_mm: largo,
          ancho_mm: ancho,
          espesor_mm: espesorLinea ?? undefined,
          tipo_forma: "rectangular",
          material_tipo: materialTipo,
          color: color ?? undefined,
          cantidad,
        });
      }
    }
  }

  return out;
}

export type DxfPiezaDetectada = {
  w?: number;
  h?: number;
  w_cm?: number;
  h_cm?: number;
  area?: number;
  estado?: string;
  tipo?: string;
};

export function buildPiezasFromDxfResult(
  res: { piezas?: DxfPiezaDetectada[] } | null | undefined,
  visitaId: string,
  materialNombre: string,
  espesorMm: number | null,
): VisitaPiezaBulkItem[] {
  const piezas = Array.isArray(res?.piezas) ? res!.piezas! : [];
  const out: VisitaPiezaBulkItem[] = [];
  let idx = 0;
  for (const p of piezas) {
    if (p.estado === "corte_interno") continue;
    const area = Number(p.area ?? 0);
    if (area <= 0) continue;
    let wMm = 0;
    let hMm = 0;
    if (p.w_cm != null && p.h_cm != null) {
      wMm = Math.max(1, Math.round(Number(p.w_cm) * 10));
      hMm = Math.max(1, Math.round(Number(p.h_cm) * 10));
    } else if (p.w != null && p.h != null) {
      wMm = Math.max(1, Math.round(Number(p.w) * 1000));
      hMm = Math.max(1, Math.round(Number(p.h) * 1000));
    }
    if (wMm <= 0 || hMm <= 0) continue;
    const largo = Math.max(wMm, hMm);
    const ancho = Math.min(wMm, hMm);
    idx += 1;
    out.push({
      visita_id: visitaId,
      nombre_pieza: `${materialNombre} · DXF ${idx}`,
      tipo_pieza: "principal",
      largo_mm: largo,
      ancho_mm: ancho,
      espesor_mm: espesorMm ?? undefined,
      tipo_forma: "rectangular",
      material_tipo: materialNombre,
      cantidad: 1,
      observaciones_tecnicas: p.tipo ? `DXF: ${p.tipo}` : undefined,
    });
  }
  return out;
}
