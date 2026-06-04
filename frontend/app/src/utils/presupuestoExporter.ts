import presupuestoTemplate from './presupuestoTemplate.html?raw';
import { getBannerImageSrcForTiles, injectPdfMarmolesImageTiles } from './marmolesPdfPageTiles';
import { PDF_MARMOLES_SVG_PUBLIC_PATH } from './pdfMarmolesLayout';

export interface DatosPresupuesto {
  id: string;
  nombreArchivo?: string;
  correlativoGlobal?: number | string;
  fecha: string;
  cliente: {
    nombre: string;
    dni_cuit: string; // Importante para facturación
    direccion: string;
    telefono: string;
    condicionIva: string; // Resp. Inscripto, Consumidor Final, etc.
  };
  empresa: {
    nombre: string;
    cuit: string;
    direccion: string;
    logoUrl?: string;
  };
  items: Array<{
    detalle: string; // Material + Lote
    medidas: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    cortes?: string;
    extras?: string;
    nombre?: string;
    concepto?: string;
    categoria?: string;
    tipo?: string;
    /** PDF: fila material m² vs servicio. */
    pdfEsMaterialM2?: boolean;
    pdfCantidadPiezas?: number | null;
    pdfMetrosCuadrados?: number | null;
    /** Columna «Medida» del PDF (ej. 1,00x0,60 m); vacío si no aplica. */
    pdfMedida?: string;
    /** Recargo de línea (si aplica) para cuadrar m² mostrado con subtotal. */
    recargoLinea?: number;
  }>;
  total: number;
  imagenPlano?: string;
  anexosImagenes?: string[];
  observaciones: string;
  linkUbicacion?: string;
  subtotalMateriales?: number;
  subtotalCortes?: number;
  subtotalExtras?: number;
  subtotalNeto?: number;
  ivaMonto?: number;
  totalFinal?: number;
  /** Porcentaje entero para la leyenda del PDF, ej. 21 (sale "IVA (21%)"). */
  ivaTasaDisplayPct?: number;
  /** Bloque HTML con condiciones de pago / descuento desde meta (vacío si no hay datos). */
  condicionesComercialesHtml?: string;
  piezasDetalle?: Array<{ w: number; h: number; agujeros: number; label: string }>;
  /** Imagen de encabezado del PDF (URL absoluta o ruta bajo `public/`). */
  encabezadoPdfUrl?: string;
  /** Imagen de pie de página del PDF. */
  piePdfUrl?: string;
  /** Suma ítems antes de descuento (desde meta / fallback). */
  subtotalBrutoPdf?: number;
  /** Monto descontado (bruto − subtotal_neto coherente). */
  montoDescuentoPdf?: number;
  /** Etiqueta del descuento en el PDF (nombre catálogo o %). */
  leyendaDescuentoPdf?: string;
}

const toSafeText = (value: unknown, fallback = '-'): string => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text) return fallback;
  const lowered = text.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') return fallback;
  return text;
};

/** Texto plano en celdas HTML del PDF (evita romper el layout si el usuario escribe < o &). */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getItemNombre = (item: any, fallback = 'Ítem'): string => {
  const normalizeNombre = (value: string): string => {
    const cleaned = value
      .replace(/^extra:\s*(undefined|null|-)?\s*$/i, '')
      .replace(/^(undefined|null|-)$/i, '')
      .trim();
    return cleaned;
  };

  const fromDetalle = normalizeNombre(toSafeText(item?.detalle, ''));
  const fromNombre = toSafeText(item?.nombre, '');
  const fromConcepto = toSafeText(item?.concepto, '');
  if (fromDetalle && fromDetalle !== '-') return fromDetalle;
  if (fromNombre && fromNombre !== '-') return fromNombre;
  if (fromConcepto && fromConcepto !== '-') return fromConcepto;
  return fallback;
};

const fmtMonto = (n: number) =>
  `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtMetroDetalle = (cm: number): string => {
  const metros = Number(cm) / 100;
  return metros.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

function fmtPdfCantidad(item: DatosPresupuesto['items'][number]): string {
  const p = item.pdfCantidadPiezas;
  if (p == null || !Number.isFinite(p)) return '';
  if (Math.abs(p - Math.round(p)) < 1e-6) return String(Math.round(p));
  return String(p);
}

function fmtPdfM2(item: DatosPresupuesto['items'][number]): string {
  if (!item.pdfEsMaterialM2) return '';
  const pu = Number(item.precioUnitario || 0);
  const tot = Number(item.total || 0);
  const rec = Number(item.recargoLinea ?? 0);
  let m: number | null =
    item.pdfMetrosCuadrados != null && Number.isFinite(Number(item.pdfMetrosCuadrados))
      ? Number(item.pdfMetrosCuadrados)
      : null;
  if (pu > 0 && tot > 0) {
    const net = tot - rec;
    const implied = net / pu;
    const m0 = m;
    if (Number.isFinite(implied) && implied > 0) {
      const errStored =
        m0 != null && Number.isFinite(m0) ? Math.abs(m0 * pu + rec - tot) : Number.POSITIVE_INFINITY;
      const errImpl = Math.abs(implied * pu + rec - tot);
      if (errStored > 0.015 && errImpl <= 0.01) {
        m = implied;
      }
    }
  }
  if (m == null || !Number.isFinite(m) || m <= 0) return '';
  return m.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}

function fmtPdfMedida(item: DatosPresupuesto['items'][number]): string {
  const s = String(item.pdfMedida ?? '').trim();
  return s;
}

/** Rutas bajo `public/` (mayúsculas/minúsculas) para resolver el banner al imprimir. */
const PRESUPUESTO_ENCABEZADO_CANDIDATES = [
  PDF_MARMOLES_SVG_PUBLIC_PATH,
  '/presupuesto-encabezado.png',
  '/presupuesto-encabezado.PNG',
] as const;
const PRESUPUESTO_PIE_CANDIDATES = [
  PDF_MARMOLES_SVG_PUBLIC_PATH,
  '/presupuesto-pie-pagina.png',
  '/presupuesto-pie-pagina.PNG',
] as const;

/** Evita depender de `new URL()` (p. ej. tests que reemplazan el global `URL`). */
function hrefDesdeOrigin(origin: string, pathOrAbs: string): string {
  const t = pathOrAbs.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  const p = t.startsWith('/') ? t : `/${t}`;
  return `${String(origin).replace(/\/$/, '')}${p}`;
}

async function fetchUrlAsDataUrl(absUrl: string): Promise<string | null> {
  try {
    const res = await fetch(absUrl, { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** SVG vía <img> e impresión: mejor raster a PNG; si falla el canvas, se mantiene el data URL. */
const DATA_URL_SVG_RE = /^data:image\/svg\+xml/i;

function rasterizeSvgDataUrlToPngIfNeeded(data: string): Promise<string> {
  if (typeof document === 'undefined' || !DATA_URL_SVG_RE.test(data)) {
    return Promise.resolve(data);
  }
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      try {
        /* ~300 dpi en 210 mm; evita el banner pixelado al imprimir / en PDF. */
        const maxW = 2480;
        const nw = im.naturalWidth;
        const nh = im.naturalHeight;
        if (nw < 1 || nh < 1) {
          resolve(data);
          return;
        }
        const scale = nw > maxW ? maxW / nw : 1;
        const w = Math.max(1, Math.round(nw * scale));
        const h = Math.max(1, Math.round(nh * scale));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(data);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(data);
      }
    };
    im.onerror = () => resolve(data);
    im.src = data;
  });
}

/** Incrusta el banner del mismo origen (data URL); SVG se convierte a PNG para impresión/compat. */
async function resolveBannerDataUrl(
  explicitUrl: string | undefined,
  defaultPaths: readonly string[],
): Promise<string | undefined> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!origin) return undefined;

  const candidates: string[] = [];
  const pushAbs = (raw: string) => {
    const h = hrefDesdeOrigin(origin, raw);
    if (h) candidates.push(h);
  };

  if (explicitUrl?.trim()) pushAbs(explicitUrl);
  for (const p of defaultPaths) pushAbs(p);

  for (const u of candidates) {
    const raw = await fetchUrlAsDataUrl(u);
    if (raw) {
      return rasterizeSvgDataUrlToPngIfNeeded(raw);
    }
  }
  return undefined;
}

export async function datosPresupuestoConBannersIncrustados(
  datos: DatosPresupuesto,
): Promise<DatosPresupuesto> {
  if (typeof window === 'undefined') return datos;
  const [enc, pie] = await Promise.all([
    resolveBannerDataUrl(datos.encabezadoPdfUrl, PRESUPUESTO_ENCABEZADO_CANDIDATES),
    resolveBannerDataUrl(datos.piePdfUrl, PRESUPUESTO_PIE_CANDIDATES),
  ]);
  return {
    ...datos,
    ...(enc ? { encabezadoPdfUrl: enc } : {}),
    ...(pie ? { piePdfUrl: pie } : {}),
  };
}

export function buildPresupuestoArgentinoHtml(datos: DatosPresupuesto): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const buildPublicUrl = (path: string) => {
    const p = path.startsWith('/') ? path : `/${path}`;
    if (origin) return hrefDesdeOrigin(origin, p);
    return p;
  };

  const anexos: string[] = [];
  if (datos.imagenPlano) anexos.push(datos.imagenPlano);
  if (Array.isArray(datos.anexosImagenes) && datos.anexosImagenes.length > 0) anexos.push(...datos.anexosImagenes);

  const filasItems = (datos.items || []).length > 0
    ? datos.items
    : [
        {
          detalle: 'Sin ítems',
          medidas: '-',
          cantidad: 0,
          precioUnitario: 0,
          total: 0,
          pdfEsMaterialM2: false,
          pdfCantidadPiezas: null,
          pdfMetrosCuadrados: null,
          pdfMedida: '',
          recargoLinea: 0,
        },
      ];

  const itemsRowsHtml = filasItems.map((item) => {
    return `
    <tr>
      <td class="cell-desc cell-desc-clean"><strong>${escapeHtml(getItemNombre(item, 'Ítem'))}</strong></td>
      <td class="cell-medida">${escapeHtml(fmtPdfMedida(item))}</td>
      <td class="right cell-qty">${escapeHtml(fmtPdfCantidad(item))}</td>
      <td class="right cell-m2">${escapeHtml(fmtPdfM2(item))}</td>
      <td class="right">${fmtMonto(Number(item.total || 0))}</td>
    </tr>
  `;
  }).join('');

  const ivaPct = Number(datos.ivaTasaDisplayPct);
  const ivaLabel = Number.isFinite(ivaPct) && ivaPct >= 0
    ? `IVA (${ivaPct}%):`
    : 'IVA:';

  const subtotalNetoVal = Number(datos.subtotalNeto ?? datos.total ?? 0);
  const ivaVal = Number(datos.ivaMonto ?? 0);
  const totalFinalVal = Number(datos.totalFinal ?? datos.total ?? subtotalNetoVal + ivaVal);
  const brutoVal = Number(datos.subtotalBrutoPdf ?? subtotalNetoVal);
  const descVal = Math.max(0, Number(datos.montoDescuentoPdf ?? 0));
  const tieneDesc = descVal >= 0.02;
  const leyDesc = String(datos.leyendaDescuentoPdf || 'Descuento').trim() || 'Descuento';

  const filasTot: string[] = [];
  if (tieneDesc) {
    filasTot.push(`
    <tr class="total-line">
      <td colspan="4" class="right total-label">Subtotal:</td>
      <td class="right total-value">${fmtMonto(brutoVal)}</td>
    </tr>
    <tr class="total-line total-discount">
      <td colspan="4" class="right total-label">${escapeHtml(leyDesc)}:</td>
      <td class="right total-value">−${fmtMonto(descVal)}</td>
    </tr>
    <tr class="total-line">
      <td colspan="4" class="right total-label">Subtotal c/desc.:</td>
      <td class="right total-value">${fmtMonto(subtotalNetoVal)}</td>
    </tr>`);
  } else {
    filasTot.push(`
    <tr class="total-line">
      <td colspan="4" class="right total-label">Subtotal:</td>
      <td class="right total-value">${fmtMonto(subtotalNetoVal)}</td>
    </tr>`);
  }
  filasTot.push(`
    <tr class="total-line total-iva-row">
      <td colspan="4" class="right total-label">${ivaLabel}</td>
      <td class="right total-value">${fmtMonto(ivaVal)}</td>
    </tr>
    <tr class="total-row">
      <td colspan="4" class="right total-final-label">TOTAL:</td>
      <td class="right total-final">${fmtMonto(totalFinalVal)}</td>
    </tr>
  `);

  const totalesRowsHtml = filasTot.join('');

  const observacionesHtml = '';

  const piezasDetalleHtml = datos.piezasDetalle && datos.piezasDetalle.length > 0
    ? `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Pieza</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Largo (m)</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Ancho (m)</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Aperturas</th>
          </tr>
        </thead>
        <tbody>
          ${datos.piezasDetalle.map((pieza, idx) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">Pieza ${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${fmtMetroDetalle(pieza.h)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${fmtMetroDetalle(pieza.w)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${pieza.agujeros > 0 ? `${pieza.agujeros} agujero${pieza.agujeros > 1 ? 's' : ''}` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p style="color: #666; padding: 10px;">No hay piezas detalladas disponibles.</p>';

  const anexosPlanoHtml = anexos.length > 0
    ? `
      <section class="page-break">
        <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px;">ANEXO 2 - Planos de Corte</h3>
        ${anexos.map((src, idx) => {
      if (!src || src.length < 100) {
        return `
              <div class="plano-container avoid-break" style="background: #f5f5f5; border: 2px dashed #ccc;">
                <p style="color: #999; font-size: 14px; margin: 0;">Plan ${idx + 1}: Imagen no disponible</p>
              </div>
            `;
      }
      return `
            <div class="plano-container avoid-break">
              <img src="${src}" class="plano-img" alt="Plano de Corte ${idx + 1}" />
            </div>
          `;
    }).join('')}
      </section>
    `
    : `
      <section class="page-break">
        <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px;">ANEXO 2 - Planos de Corte</h3>
        <div class="plano-container avoid-break" style="background: #f5f5f5; border: 2px dashed #ccc;">
          <p style="color: #666; font-size: 14px; margin: 0;">No hay planos disponibles</p>
        </div>
      </section>
    `;

  let html = presupuestoTemplate;
  const replacements: Record<string, string> = {
    '__TITLE__': toSafeText(datos.nombreArchivo || `Presupuesto ${datos.id}`),
    '__EMPRESA_CUIT__': toSafeText(datos.empresa?.cuit, ''),
    '__EMPRESA_DIRECCION__': toSafeText(datos.empresa?.direccion, ''),
    '__DOC_ID__': toSafeText(datos.id),
    '__CORRELATIVO_HTML__': datos.correlativoGlobal
      ? `<span class="doc-inline-part muted"><strong>Corr.</strong> ${datos.correlativoGlobal}</span>`
      : '',
    '__FECHA__': toSafeText(datos.fecha, new Date().toLocaleDateString('es-AR')),
    '__VENCIMIENTO__': new Date(Date.now() + 2 * 86400000).toLocaleDateString(),
    '__CLIENTE_NOMBRE__': toSafeText(datos.cliente?.nombre, 'Cliente'),
    '__CLIENTE_DNI__': toSafeText(datos.cliente?.dni_cuit),
    '__CLIENTE_DIRECCION__': toSafeText(datos.cliente?.direccion),
    '__CLIENTE_IVA__': toSafeText(datos.cliente?.condicionIva, 'Consumidor Final'),
    '__CLIENTE_TELEFONO__': toSafeText(datos.cliente?.telefono),
    '__LINK_UBICACION_HTML__': datos.linkUbicacion
      ? `<div class="cliente-extra"><span class="label">Ubicación</span> <a href="${datos.linkUbicacion}" target="_blank" class="link-ubicacion">Ver en mapa</a></div>`
      : '',
    '__ENCABEZADO_PDF_URL__': toSafeText(
      datos.encabezadoPdfUrl,
      buildPublicUrl(PDF_MARMOLES_SVG_PUBLIC_PATH),
    ),
    '__PIE_PDF_URL__': toSafeText(datos.piePdfUrl, buildPublicUrl(PDF_MARMOLES_SVG_PUBLIC_PATH)),
    '__LOGO_FALLBACK_URL__': toSafeText(datos.empresa?.logoUrl, buildPublicUrl('/logo_pdf.jpg')),
    '__ITEMS_ROWS__': itemsRowsHtml,
    '__TOTALES_ROWS__': totalesRowsHtml,
    '__EXTRAS_TABLE_HTML__': '',
    '__OBSERVACIONES_HTML__': observacionesHtml,
    '__CONDICIONES_COMERCIALES_HTML__': String(datos.condicionesComercialesHtml || '').trim(),
    '__PIEZAS_DETALLE_HTML__': piezasDetalleHtml,
    '__ANEXOS_PLANO_HTML__': anexosPlanoHtml,
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}

const canUseDomPdfExport = (): boolean => {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.body;
};

let presupuestoExportInProgress = false;

export const waitForImages = async (root: ParentNode): Promise<void> => {
  const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  if (images.length === 0) return;

  await Promise.all(images.map(async (img) => {
    if (img.complete && img.naturalWidth > 0) return;
    try {
      if (typeof img.decode === 'function') {
        await img.decode();
        return;
      }
    } catch {
      // continue with load/error listeners below
    }
    await new Promise<void>((resolve) => {
      const done = () => {
        img.removeEventListener('load', done);
        img.removeEventListener('error', done);
        resolve();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }));
};

export type PresupuestoDocumentWindowMode = 'preview' | 'print';

function injectPresupuestoPreviewToolbar(popup: Window): void {
  const doc = popup.document;
  const style = doc.createElement('style');
  style.textContent = `
    .pdf-preview-toolbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #0f172a; color: #f8fafc; padding: 10px 14px; display: flex; gap: 10px;
      align-items: center; font-family: system-ui, sans-serif; font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,.2);
    }
    .pdf-preview-toolbar button {
      padding: 8px 14px; cursor: pointer; border: none; border-radius: 6px;
      font-size: 13px; background: #e2e8f0; color: #0f172a;
    }
    .pdf-preview-toolbar button:hover { background: #cbd5e1; }
    .pdf-preview-toolbar .pv-title { font-weight: 600; }
    @media print {
      .pdf-preview-toolbar { display: none !important; }
    }
  `;
  doc.head.appendChild(style);
  const bar = doc.createElement('div');
  bar.className = 'pdf-preview-toolbar';
  bar.innerHTML =
    '<span class="pv-title">Vista previa del presupuesto</span>' +
    '<button type="button" id="pv-print">Imprimir…</button>' +
    '<button type="button" id="pv-close" style="margin-left:auto;background:#334155;color:#f8fafc">Cerrar</button>';
  doc.body.insertBefore(bar, doc.body.firstChild);
  doc.getElementById('pv-print')?.addEventListener('click', () => {
    popup.focus();
    popup.print();
  });
  doc.getElementById('pv-close')?.addEventListener('click', () => {
    popup.close();
  });
  doc.body.style.paddingTop = '52px';
}

async function openPresupuestoHtmlWindow(
  html: string,
  mode: PresupuestoDocumentWindowMode,
  encabezadoUrlHint?: string,
): Promise<void> {
  const popup = window.open('', '_blank', 'width=1000,height=800');
  if (!popup) return;

  const htmlWithBase = html.includes('<head>')
    ? html.replace('<head>', `<head><base href="${window.location.origin}/">`)
    : html;

  popup.document.open();
  popup.document.write(htmlWithBase);
  popup.document.close();

  const closeAfterPrint = () => {
    if (popup && !popup.closed) {
      popup.close();
    }
  };

  if (mode === 'print') {
    popup.addEventListener('afterprint', closeAfterPrint, { once: true });
  }

  await new Promise<void>((resolve) => {
    if (popup.document.readyState === 'complete') {
      resolve();
      return;
    }

    const onLoaded = () => {
      popup.removeEventListener('load', onLoaded);
      resolve();
    };

    popup.addEventListener('load', onLoaded);
    window.setTimeout(() => {
      popup.removeEventListener('load', onLoaded);
      resolve();
    }, 2500);
  });

  const doc = popup.document;
  const body = doc.body;
  await waitForImages(doc);

  await new Promise<void>((resolve) => {
    popup.requestAnimationFrame(() => {
      popup.requestAnimationFrame(() => resolve());
    });
  });

  if (mode === 'preview') {
    injectPresupuestoPreviewToolbar(popup);
  }

  const src = getBannerImageSrcForTiles(body, encabezadoUrlHint);
  if (src) {
    injectPdfMarmolesImageTiles(doc, body, src);
    const layer = doc.querySelector('.pdf-marmoles-tile-layer');
    if (layer) {
      await waitForImages(layer);
    }
  }

  popup.focus();

  if (mode === 'print') {
    popup.print();
    setTimeout(() => {
      if (popup && !popup.closed) {
        popup.close();
      }
    }, 30000);
  }
}

export async function previsualizarPresupuestoArgentino(datos: DatosPresupuesto): Promise<void> {
  if (presupuestoExportInProgress) {
    console.warn('Exportacion de presupuesto ya en progreso, se omite llamada duplicada');
    return;
  }

  presupuestoExportInProgress = true;

  try {
    if (!canUseDomPdfExport()) {
      console.error('DOM/Window no disponibles');
      return;
    }

    const datosConImg = await datosPresupuestoConBannersIncrustados(datos);
    const html = buildPresupuestoArgentinoHtml(datosConImg);
    await openPresupuestoHtmlWindow(html, 'preview', datosConImg.encabezadoPdfUrl);
  } catch (error) {
    console.error('Error abriendo vista previa del presupuesto:', error);
  } finally {
    presupuestoExportInProgress = false;
  }
}

export async function imprimirPresupuestoArgentino(datos: DatosPresupuesto): Promise<void> {
  if (presupuestoExportInProgress) {
    console.warn('Exportacion de presupuesto ya en progreso, se omite llamada duplicada');
    return;
  }

  presupuestoExportInProgress = true;

  try {
    if (!canUseDomPdfExport()) {
      console.error('DOM/Window no disponibles');
      return;
    }

    const datosConImg = await datosPresupuestoConBannersIncrustados(datos);
    const html = buildPresupuestoArgentinoHtml(datosConImg);
    await openPresupuestoHtmlWindow(html, 'print', datosConImg.encabezadoPdfUrl);
  } catch (error) {
    console.error('Error abriendo presupuesto para imprimir:', error);
  } finally {
    presupuestoExportInProgress = false;
  }
}

export function imprimirAnexosPlano(clienteNombre: string, presupuestoId: string, anexosImagenes: string[]) {
  if (!anexosImagenes || anexosImagenes.length === 0) {
    console.warn('No hay planos/anexos para descargar');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Plano Técnico ${presupuestoId}</title>
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0 0 5px 0; font-size: 18px; text-transform: uppercase; }
        .header p { margin: 2px 0; color: #555; font-size: 11px; }
        
        .plano-container { 
          border: 1px solid #ddd; 
          padding: 15px; 
          text-align: center; 
          margin-bottom: 20px; 
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .plano-img { max-width: 95%; max-height: 800px; object-fit: contain; }

        .page-break { break-before: page; page-break-before: always; }
        .avoid-break { break-inside: avoid-page; page-break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PLANO TÉCNICO</h1>
        <p><strong>Cliente:</strong> ${clienteNombre}</p>
        <p><strong>Presupuesto:</strong> ${presupuestoId}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      ${anexosImagenes.map((src, idx) => `
        ${idx > 0 ? '<div class="page-break"></div>' : ''}
        <div class="plano-container avoid-break">
          <img src="${src}" class="plano-img" alt="Plano Técnico ${idx + 1}" />
        </div>
      `).join('')}

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
}
