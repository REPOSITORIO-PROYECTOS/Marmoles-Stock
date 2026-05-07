/**
 * Capa única de interpretación del presupuesto: payload crudo del backend → DatosPresupuesto.
 * Todas las vistas (PDF, CRM vía download, historial, finanzas) deben usar esta tubería.
 */
import type { DatosPresupuesto } from './presupuestoExporter';
import { formatFechaPresupuestoPdfDisplay, parseMsFromBackendFecha } from './fechaArgentina';
import { generatePlanImage } from './planImage';

/** Payload alineado a GET /api/presupuestos/{id} (campos opcionales tolerantes). */
export interface PresupuestoLineaApi {
  id?: string;
  tipo?: string | null;
  material?: string | null;
  medidas?: string | null;
  metros_cuadrados?: number | null;
  unidad?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  recargo_extra?: number | null;
  lote_id?: string | null;
  cortes_especiales?: boolean | null;
  agujeros?: number | null;
  geometria_json?: string | null;
}

export interface PresupuestoMetaApi {
  items_adicionales?: unknown[];
  subtotal_materiales?: number;
  subtotal_extras?: number;
  subtotal_neto?: number;
  iva_monto?: number;
  total_final?: number;
  /** Decimal típico 0.21 (backend) o porcentaje 21 si ya viniera así. */
  iva_tasa?: number;
  correlativo_global?: number;
  tipo_cobro?: string;
  plazo_pago_nombre?: string;
  descuento_catalogo?: { id?: string; nombre?: string; tipo?: string; valor?: number };
  descuento_valor?: number;
  descuento_tipo?: string;
  condiciones_comerciales?: { plazo_pago?: string; descuento?: string };
  /** Texto libre del usuario para PDF (persistido por backend). */
  condiciones_pago_texto_usuario?: string | null;
  [key: string]: unknown;
}

export interface PresupuestoApiPayload {
  id: string;
  /** Código comercial único (ej. P00001); obligatorio para PDF/nombre de archivo. */
  codigo?: string | null;
  cliente_id?: string | null;
  total?: number | null;
  observaciones?: string | null;
  comentario?: string | null;
  coordenadas?: string | null;
  lineas?: PresupuestoLineaApi[];
  meta?: PresupuestoMetaApi | null;
  subtotal_neto?: number | null;
  iva_monto?: number | null;
  total_final?: number | null;
  correlativo_global?: number | null;
  createdAt?: string | number | null;
}

export interface PresupuestoRenderCliente {
  nombre: string;
  dni_cuit?: string;
  direccion?: string;
  telefono?: string;
  condicionIva?: string;
}

export interface PresupuestoRenderContext {
  cliente: PresupuestoRenderCliente;
  /** Si no se pasa, se usa DEFAULT_EMPRESA_PRESUPUESTO */
  empresa?: DatosPresupuesto['empresa'];
  fecha?: string;
  linkUbicacion?: string;
  nombreArchivo?: string;
  /** Id corto tipo P-XXXXXX; por defecto últimos 6 del id UUID */
  docId?: string;
  encabezadoPdfUrl?: string;
  piePdfUrl?: string;
}

export const DEFAULT_EMPRESA_PRESUPUESTO: DatosPresupuesto['empresa'] = {
  nombre: 'JAVIER FLORES MÁRMOLES Y GRANITOS',
  cuit: '20-29602748-1',
  direccion: 'España 1031 (N) - San Juan',
};

function normUnidad(u: string | null | undefined): string {
  const s = String(u || 'm²').trim();
  return s || 'm²';
}

function isMaterialM2Line(linea: PresupuestoLineaApi): boolean {
  const tipo = String(linea.tipo || 'material').toLowerCase();
  const u = normUnidad(linea.unidad).toLowerCase();
  return tipo === 'material' && (u === 'm²' || u === 'm2');
}

function parseLocaleFloatDim(s: string): number {
  const t = String(s).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Largo × ancho en metros desde un fragmento (p. ej. "300 x 150 cm", "1,00×0,60 m").
 * No interpreta líneas solo de m² agregados ("2 piezas × 1,2 m²…") sin dimensiones lineales.
 */
export function parseMedidasDimensionMetros(fragment: string): { largo_m: number; ancho_m: number } | null {
  const s = String(fragment || '').trim();
  if (!s) return null;
  const tryPat = (
    re: RegExp,
    toM: (a: number, b: number) => [number, number],
  ): { largo_m: number; ancho_m: number } | null => {
    const m = s.match(re);
    if (!m) return null;
    const a = parseLocaleFloatDim(m[1]!);
    const b = parseLocaleFloatDim(m[2]!);
    if (!(a > 0 && b > 0)) return null;
    const [L, W] = toM(a, b);
    if (!(L > 0 && W > 0)) return null;
    return { largo_m: L, ancho_m: W };
  };
  return (
    tryPat(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\s*cm\b/i, (a, b) => [a / 100, b / 100]) ||
    tryPat(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\s*mm\b/i, (a, b) => [a / 1000, b / 1000]) ||
    tryPat(/(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\s*m(?![²\u00b2\u2082])/i, (a, b) => [a, b]) ||
    null
  );
}

/**
 * Formato único largo×ancho (m) para fila de presupuesto / columna Medida del PDF: es-AR, hasta 4 decimales.
 * Debe ser idéntico a lo que se envía en `lineas.medidas` cuando hay `largo_m`/`ancho_m` en el constructor.
 */
export function formatLargoAnchoMLineaMedida(largo_m: number, ancho_m: number): string {
  const fmt = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  return `${fmt(largo_m)}×${fmt(ancho_m)} m`;
}

function primeraPiezaMetrosDesdeGeometria(linea: PresupuestoLineaApi): { largo_m: number; ancho_m: number } | null {
  if (!linea.geometria_json) return null;
  const geo = parseGeometria(linea.geometria_json);
  if (!geo) return null;
  const placements = Array.isArray(geo.placements) ? geo.placements : [];
  if (placements.length === 0) return null;
  const pl = placements[0] as Record<string, unknown>;
  const wCm = Number(pl.w ?? pl.ancho ?? 0);
  const hCm = Number(pl.h ?? pl.largo ?? 0);
  if (wCm > 0 && hCm > 0) {
    return { largo_m: wCm / 100, ancho_m: hCm / 100 };
  }
  return null;
}

/** Texto columna «Medida» del PDF para material m² (plano o texto API); vacío en servicios / unidades. */
export function pdfMedidaDesdeLinea(linea: PresupuestoLineaApi): string {
  if (!isMaterialM2Line(linea)) return '';

  const med = String(linea.medidas || '').trim();
  if (med) {
    const head = med.split('·')[0]?.trim() ?? '';
    const dims = parseMedidasDimensionMetros(head) || parseMedidasDimensionMetros(med);
    if (dims) return formatLargoAnchoMLineaMedida(dims.largo_m, dims.ancho_m);
  }

  const desdeGeo = primeraPiezaMetrosDesdeGeometria(linea);
  if (desdeGeo) return formatLargoAnchoMLineaMedida(desdeGeo.largo_m, desdeGeo.ancho_m);
  return '';
}

/** Texto de medidas: solo datos del API; si falta, derivación mínima por unidad/cantidad (no placeholders genéricos). */
export function medidasTextoDesdeLinea(linea: PresupuestoLineaApi): string {
  const raw = String(linea.medidas ?? '').trim();
  if (raw) return raw;

  const m2 = Number(linea.metros_cuadrados ?? 0);
  const cant = linea.cantidad != null ? Number(linea.cantidad) : NaN;
  const u = normUnidad(linea.unidad);

  if (isMaterialM2Line(linea)) {
    return `${m2} m²`;
  }
  if (!Number.isNaN(cant) && cant > 0) {
    return `${cant} ${u}`;
  }
  if (m2 > 0) {
    return `${m2} ${u}`;
  }
  return '—';
}

function detalleMaterialLinea(linea: PresupuestoLineaApi): string {
  const mat = String(linea.material ?? '').trim() || 'Ítem';
  const lote = linea.lote_id ? ` (Lote: ${linea.lote_id})` : '';
  return `${mat}${lote}`;
}

function cortesTexto(linea: PresupuestoLineaApi): string | undefined {
  if (!linea.cortes_especiales) return undefined;
  const n = Number(linea.agujeros ?? 0);
  return n > 0 ? `${n} agujeros` : 'Cortes especiales';
}

/** Ej. medidas API del constructor: "2 piezas × 1,2 m² c/u (2,4 m² total)". */
function piezasDesdeMedidasLinea(medidas: string | null | undefined): number | null {
  const med = String(medidas || '');
  let m = /^\s*(\d+)\s*piezas\s*[×x]/i.exec(med);
  if (m) return Math.max(1, parseInt(m[1], 10));
  m = /^\s*(\d+)\s*piezas\b/i.exec(med);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return null;
}

/** Columnas PDF: cantidad (piezas o unid.) y m² solo en material m². */
function pdfItemColumnsFromLinea(
  linea: PresupuestoLineaApi,
  qtyForBilling: number,
): Pick<DatosPresupuesto['items'][number], 'pdfEsMaterialM2' | 'pdfCantidadPiezas' | 'pdfMetrosCuadrados'> {
  const m2v = Number(linea.metros_cuadrados ?? 0);
  const cr = linea.cantidad != null ? Number(linea.cantidad) : NaN;
  if (isMaterialM2Line(linea)) {
    let piezas: number | null = null;
    if (Number.isFinite(cr) && cr > 0) {
      const crInt = Math.abs(cr - Math.round(cr)) < 1e-6 ? Math.round(cr) : null;
      if (crInt != null && crInt >= 1) {
        piezas = Math.abs(cr - m2v) < 1e-6 ? 1 : Math.max(1, crInt);
      } else {
        piezas = Math.abs(cr - m2v) < 1e-6 ? 1 : Math.max(1, Math.floor(cr));
      }
    }
    if (piezas == null || piezas < 1) {
      const fromMed = piezasDesdeMedidasLinea(linea.medidas);
      piezas = fromMed ?? (m2v > 0 ? 1 : null);
    }
    return {
      pdfEsMaterialM2: true,
      pdfCantidadPiezas: piezas,
      pdfMetrosCuadrados: m2v > 0 ? m2v : null,
    };
  }
  return {
    pdfEsMaterialM2: false,
    pdfCantidadPiezas: Number.isFinite(qtyForBilling) && qtyForBilling > 0 ? qtyForBilling : null,
    pdfMetrosCuadrados: null,
  };
}

/**
 * Línea API → fila PDF. El monto de línea es `metros_cuadrados`×`precio_unitario`+`recargo_extra`
 * (no hay importe persistido por línea en el modelo). `pdfMedida` (L×W) es solo descriptivo;
 * no sustituye el m² facturable, que sale siempre de `metros_cuadrados`.
 */
function lineaToItem(linea: PresupuestoLineaApi): DatosPresupuesto['items'][number] {
  const m2 = Number(linea.metros_cuadrados ?? 0);
  const cant = linea.cantidad != null ? Number(linea.cantidad) : m2;
  const pu = Number(linea.precio_unitario ?? 0);
  const recargo = Number(linea.recargo_extra ?? 0);
  const qty = isMaterialM2Line(linea) ? m2 : cant;
  const total = qty * pu + recargo;
  const tipo = String(linea.tipo || 'material').toLowerCase();
  const esExtraTabla =
    !isMaterialM2Line(linea) ||
    ['servicio', 'accesorio', 'producto', 'extra'].includes(tipo);

  const pdfCols = pdfItemColumnsFromLinea(linea, qty);
  const base = {
    ...pdfCols,
    detalle: detalleMaterialLinea(linea),
    medidas: medidasTextoDesdeLinea(linea),
    cantidad: qty,
    precioUnitario: pu,
    total,
    recargoLinea: recargo,
    cortes: cortesTexto(linea),
    pdfMedida: pdfMedidaDesdeLinea(linea),
  };

  if (esExtraTabla && !isMaterialM2Line(linea)) {
    return {
      ...base,
      nombre: base.detalle,
      tipo: 'extra',
      categoria: normUnidad(linea.unidad),
      extras: normUnidad(linea.unidad),
    };
  }

  return base;
}

function itemsAdicionalToItem(raw: any): DatosPresupuesto['items'][number] {
  const nombre = String(raw?.nombre ?? raw?.concepto ?? '').trim() || 'Ítem adicional';
  const cant = Number(raw?.cantidad ?? 1);
  const precio = Number(raw?.precio ?? 0);
  const cat = String(raw?.categoria ?? 'unidades').trim();
  return {
    pdfEsMaterialM2: false,
    pdfCantidadPiezas: cant > 0 ? cant : null,
    pdfMetrosCuadrados: null,
    pdfMedida: '',
    detalle: nombre,
    nombre,
    medidas: `${cant} ${cat}`,
    cantidad: cant,
    precioUnitario: precio,
    total: precio * cant,
    recargoLinea: 0,
    tipo: 'extra',
    categoria: cat,
    extras: cat,
  };
}

export type PiezaDetalleCanonico = { w: number; h: number; agujeros: number; label: string };

function parseGeometria(geoRaw: string): Record<string, unknown> | null {
  try {
    const g = JSON.parse(geoRaw) as Record<string, unknown>;
    return g && typeof g === 'object' ? g : null;
  } catch {
    return null;
  }
}

/** Tablero efectivo para planImage (cm). */
export function effectiveBoardFromGeometria(geo: Record<string, unknown>): { width: number; height: number } {
  const b = (geo.boardConfig || geo.effective_board) as Record<string, unknown> | undefined;
  if (!b || typeof b !== 'object') {
    return { width: 300, height: 180 };
  }
  const width = Number((b as any).ancho ?? (b as any).width ?? 300);
  const height = Number((b as any).largo ?? (b as any).height ?? 180);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 300,
    height: Number.isFinite(height) && height > 0 ? height : 180,
  };
}

/** Piezas para tabla de detalle del PDF (misma semántica que antes en CRM/visita). */
export function extractPiezasDetalle(payload: PresupuestoApiPayload): PiezaDetalleCanonico[] {
  const lineas = Array.isArray(payload.lineas) ? payload.lineas : [];
  const out: PiezaDetalleCanonico[] = [];

  lineas.forEach((l, idx) => {
    if (!l.geometria_json) return;
    const geo = parseGeometria(l.geometria_json);
    if (!geo) return;
    const placements = Array.isArray(geo.placements) ? geo.placements : [];
    placements.forEach((pl: any, pIdx: number) => {
      const w = Number(pl.w ?? pl.ancho ?? 0);
      const h = Number(pl.h ?? pl.largo ?? 0);
      const agujeros = Array.isArray(pl.agujeros) ? pl.agujeros.length : Number(pl.agujeros ?? 0) || 0;
      out.push({
        w,
        h,
        agujeros,
        label: `Pieza ${idx + 1}.${pIdx + 1}: ${w} × ${h} cm${agujeros ? ` (${agujeros} aguj.)` : ''}`,
      });
    });
  });

  return out;
}

/** Imágenes de plano para anexos (misma lógica unificada). */
export function extractAnexosPlanoImages(payload: PresupuestoApiPayload): string[] {
  const lineas = Array.isArray(payload.lineas) ? payload.lineas : [];
  const anexos: string[] = [];

  for (const l of lineas) {
    if (!l.geometria_json) continue;
    const geo = parseGeometria(l.geometria_json);
    if (!geo) continue;
    const { width, height } = effectiveBoardFromGeometria(geo);
    const plan = {
      effective_board: { width, height },
      placements: Array.isArray(geo.placements) ? geo.placements : [],
      cuts: Array.isArray(geo.cuts) ? geo.cuts : [],
      features: Array.isArray(geo.features) ? geo.features : [],
    };
    const img = generatePlanImage(plan);
    if (img && img.length > 100) anexos.push(img);
    else if (img) anexos.push(img);
  }

  return anexos;
}

function metaObj(payload: PresupuestoApiPayload): PresupuestoMetaApi {
  const m = payload.meta;
  return m && typeof m === 'object' ? m : {};
}

function escapeHtmlCondiciones(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML compacto: forma de pago + texto libre del usuario (el descuento va en el resumen financiero del PDF). */
export function condicionesComercialesHtmlDesdeMeta(meta: PresupuestoMetaApi): string {
  const cc = meta.condiciones_comerciales;
  let plazo = '';
  if (cc && typeof cc === 'object' && !Array.isArray(cc)) {
    const p0 = String((cc as { plazo_pago?: string }).plazo_pago ?? '').trim();
    if (p0) plazo = p0;
  }
  if (!plazo) {
    plazo = String(meta.plazo_pago_nombre || meta.tipo_cobro || '').trim();
  }
  const textoUsuario = String(meta.condiciones_pago_texto_usuario ?? '').trim();
  if (!plazo && !textoUsuario) return '';

  const plazoHtml = plazo
    ? escapeHtmlCondiciones(plazo).replace(/\r?\n/g, '<br />')
    : '';
  const textoUsuarioHtml = textoUsuario
    ? escapeHtmlCondiciones(textoUsuario).replace(/\r?\n/g, '<br />')
    : '';

  const inner: string[] = ['<strong>Condiciones comerciales</strong>'];
  if (plazoHtml) {
    inner.push(
      `<p class="condiciones-comerciales-line"><strong>Forma de pago:</strong> ${plazoHtml}</p>`,
    );
  }
  if (textoUsuarioHtml) {
    inner.push(
      `<p class="condiciones-comerciales-line condiciones-comerciales-usuario">${textoUsuarioHtml}</p>`,
    );
  }
  return `<div class="condiciones-comerciales">\n      ${inner.join('\n      ')}\n    </div>`.trim();
}

const PDF_FIN_EPS = 0.02;

/** Bruto, monto descontado y leyenda para el PDF (solo lectura de meta + coherencia con neto). */
export function pdfResumenFinancieroDesdeMeta(
  meta: PresupuestoMetaApi,
  items: DatosPresupuesto['items'],
  subtotalNeto: number,
): { subtotalBruto: number; montoDescuento: number; leyendaDescuento: string } {
  const subMat = meta.subtotal_materiales != null ? Number(meta.subtotal_materiales) : NaN;
  const subExt = meta.subtotal_extras != null ? Number(meta.subtotal_extras) : NaN;
  const sumItems = items.reduce((s, it) => s + Number(it.total ?? 0), 0);
  let subtotalBruto = Number.isFinite(subMat) && Number.isFinite(subExt) ? subMat + subExt : sumItems;

  const neto = Number(subtotalNeto);
  if (subtotalBruto + PDF_FIN_EPS < neto) {
    subtotalBruto = sumItems;
  }
  if (subtotalBruto + PDF_FIN_EPS < neto) {
    subtotalBruto = neto;
  }

  let montoDescuento = Math.max(0, subtotalBruto - neto);
  if (montoDescuento < PDF_FIN_EPS) montoDescuento = 0;

  let leyendaDescuento = '';
  const dc = meta.descuento_catalogo;
  if (dc && typeof dc === 'object' && String(dc.nombre || '').trim()) {
    const t = String(dc.tipo || '').toLowerCase();
    const v = Number(dc.valor ?? 0);
    leyendaDescuento =
      t === 'porcentaje' ? `${String(dc.nombre)} (${v}%)` : String(dc.nombre);
  } else if (Number(meta.descuento_valor) > 0) {
    const dt = String(meta.descuento_tipo || '').toLowerCase();
    const v = Number(meta.descuento_valor);
    leyendaDescuento = dt === 'porcentaje' ? `Descuento (${v}%)` : 'Descuento';
  } else if (montoDescuento >= PDF_FIN_EPS) {
    leyendaDescuento = 'Descuento';
  }

  return { subtotalBruto, montoDescuento, leyendaDescuento };
}

/** Entero para leyenda "IVA (21%)" a partir de meta/payload (0.21 → 21). */
export function ivaTasaMetaToDisplayPct(meta: PresupuestoMetaApi, payload?: PresupuestoApiPayload): number {
  const raw = meta.iva_tasa ?? (payload as { iva_tasa?: number } | undefined)?.iva_tasa;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 21;
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

/** Suma de subtotales desde ítems construidos (fallback si meta no trae desglose). */
function sumarSubtotalesPorItems(items: DatosPresupuesto['items']): { materiales: number; extras: number } {
  const isExtra = (it: (typeof items)[number]) => {
    const t = String((it as any).tipo || '').toLowerCase();
    const d = String(it.detalle || '').toLowerCase();
    return t === 'extra' || d.startsWith('adicional:') || !!(it as any).categoria;
  };
  let materiales = 0;
  let extras = 0;
  for (const it of items) {
    const t = Number(it.total ?? 0);
    if (isExtra(it)) extras += t;
    else materiales += t;
  }
  return { materiales, extras };
}

/**
 * Convierte el payload del backend en DatosPresupuesto listo para imprimirPresupuestoArgentino.
 * No inventa textos de medidas ni observaciones genéricas.
 */
export function presupuestoApiToDatosPresupuesto(
  payload: PresupuestoApiPayload,
  ctx: PresupuestoRenderContext,
): DatosPresupuesto {
  const meta = metaObj(payload);
  const lineas = Array.isArray(payload.lineas) ? payload.lineas : [];

  const itemsFromLineas = lineas.map(lineaToItem);
  const adicionales = Array.isArray(meta.items_adicionales) ? meta.items_adicionales : [];
  const itemsAdic = adicionales.map((x) => itemsAdicionalToItem(x));
  const items = [...itemsFromLineas, ...itemsAdic];

  const { materiales: sumMat, extras: sumExt } = sumarSubtotalesPorItems(items);
  const subtotalMateriales =
    meta.subtotal_materiales != null ? Number(meta.subtotal_materiales) : sumMat;
  const subtotalExtras = meta.subtotal_extras != null ? Number(meta.subtotal_extras) : sumExt;

  const subtotalNeto = Number(
    payload.subtotal_neto ?? meta.subtotal_neto ?? payload.total ?? 0,
  );
  const ivaMonto = Number(payload.iva_monto ?? meta.iva_monto ?? 0);
  const totalFinal = Number(
    payload.total_final ?? meta.total_final ?? payload.total ?? subtotalNeto + ivaMonto,
  );
  const ivaTasaDisplayPct = ivaTasaMetaToDisplayPct(meta, payload);

  const correlativo = Number(
    payload.correlativo_global ?? meta.correlativo_global ?? 0,
  );

  const obsRaw = String(payload.observaciones ?? payload.comentario ?? '').trim();

  const codigoStr = String(payload.codigo ?? '').trim();
  const docId = ctx.docId?.trim() || codigoStr || `P-${String(payload.id).slice(-6)}`;

  const piezasDetalle = extractPiezasDetalle(payload);
  const anexosImagenes = extractAnexosPlanoImages(payload);
  const condicionesComercialesHtml = condicionesComercialesHtmlDesdeMeta(meta);
  const { subtotalBruto, montoDescuento, leyendaDescuento } = pdfResumenFinancieroDesdeMeta(
    meta,
    items,
    subtotalNeto,
  );

  return {
    id: docId,
    nombreArchivo: ctx.nombreArchivo,
    correlativoGlobal: correlativo > 0 ? correlativo : undefined,
    fecha: (() => {
      const rawCtx = ctx.fecha?.trim();
      if (rawCtx) return formatFechaPresupuestoPdfDisplay(rawCtx);
      if (payload.createdAt != null && payload.createdAt !== '') {
        const ms = parseMsFromBackendFecha(payload.createdAt);
        return new Date(ms).toLocaleDateString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
      return new Date().toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    })(),
    cliente: {
      nombre: ctx.cliente.nombre || 'Cliente',
      dni_cuit: ctx.cliente.dni_cuit ?? '',
      direccion: ctx.cliente.direccion ?? '',
      telefono: ctx.cliente.telefono ?? '',
      condicionIva: ctx.cliente.condicionIva ?? 'Consumidor Final',
    },
    empresa: ctx.empresa ?? DEFAULT_EMPRESA_PRESUPUESTO,
    linkUbicacion: ctx.linkUbicacion,
    items,
    total: Number(payload.total ?? totalFinal),
    subtotalMateriales,
    subtotalExtras,
    subtotalNeto,
    ivaMonto,
    totalFinal,
    ivaTasaDisplayPct,
    condicionesComercialesHtml: condicionesComercialesHtml || undefined,
    observaciones: obsRaw,
    piezasDetalle: piezasDetalle.length > 0 ? piezasDetalle : undefined,
    anexosImagenes: anexosImagenes.length > 0 ? anexosImagenes : undefined,
    encabezadoPdfUrl: ctx.encabezadoPdfUrl,
    piePdfUrl: ctx.piePdfUrl,
    subtotalBrutoPdf: subtotalBruto,
    montoDescuentoPdf: montoDescuento,
    leyendaDescuentoPdf: leyendaDescuento,
  };
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Nombre visible en cliente para el archivo PDF (sin caracteres inválidos en Windows). */
export function sanitizeClienteNombreArchivo(nombreCliente: string): string {
  const base = (nombreCliente || 'Cliente').trim() || 'Cliente';
  const cleaned = base.replace(INVALID_FILENAME_CHARS, '').replace(/\s+/g, ' ').trim();
  return cleaned || 'Cliente';
}

/**
 * Nombre comercial del PDF: `P00001 - Cliente - 2026-04-07.pdf`
 * @throws Error con mensaje `PRESUPUESTO_SIN_CODIGO` si falta código.
 */
export function buildNombreArchivoPresupuestoComercial(
  codigo: string,
  nombreCliente: string,
  fechaIso?: string,
): string {
  const cod = String(codigo ?? '').trim();
  if (!cod) {
    const err = new Error('PRESUPUESTO_SIN_CODIGO');
    (err as Error & { code?: string }).code = 'PRESUPUESTO_SIN_CODIGO';
    throw err;
  }
  const cli = sanitizeClienteNombreArchivo(nombreCliente);
  const fecha =
    (fechaIso && /^\d{4}-\d{2}-\d{2}$/.test(fechaIso) ? fechaIso : null) ||
    new Date().toISOString().slice(0, 10);
  return `${cod} - ${cli} - ${fecha}.pdf`;
}

/** @deprecated Usar buildNombreArchivoPresupuestoComercial con codigo comercial. */
export function buildNombreArchivoPresupuesto(correlativo: number, nombreCliente: string): string {
  const correlativoText = correlativo > 0 ? String(correlativo).padStart(6, '0') : '000000';
  const fakeCodigo = `P${correlativoText}`;
  try {
    return buildNombreArchivoPresupuestoComercial(fakeCodigo, nombreCliente);
  } catch {
    return `presupuesto_${correlativoText}_${sanitizeClienteNombreArchivo(nombreCliente).replace(/\s/g, '_')}.pdf`;
  }
}
