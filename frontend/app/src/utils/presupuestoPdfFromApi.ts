import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { get } from '../api';
import { toast } from 'sonner';
import {
  buildPresupuestoArgentinoHtml,
  datosPresupuestoConBannersIncrustados,
  imprimirPresupuestoArgentino,
  previsualizarPresupuestoArgentino,
  waitForImages,
} from './presupuestoExporter';
import { getBannerImageSrcForTiles, injectPdfMarmolesImageTiles } from './marmolesPdfPageTiles';
import {
  buildNombreArchivoPresupuestoComercial,
  presupuestoApiToDatosPresupuesto,
  sanitizeClienteNombreArchivo,
  type PresupuestoApiPayload,
} from './presupuestoRenderer';

export type PresupuestoPdfCliente = {
  nombre: string;
  dni?: string;
  direccion: string;
  telefono: string;
  coordenadas?: string;
};

/** Carga presupuesto por ID y genera el PDF vía renderer único. */
export async function downloadPresupuestoPdf(
  presupuestoId: string,
  cliente: PresupuestoPdfCliente,
): Promise<void> {
  toast.info('Cargando presupuesto...');
  const data = (await get<PresupuestoApiPayload>(`/api/presupuestos/${presupuestoId}`)) as PresupuestoApiPayload;

  let linkUbicacion: string | undefined;
  if (cliente.coordenadas) {
    const coords = cliente.coordenadas.replace(/\s/g, '');
    linkUbicacion = `https://www.google.com/maps?q=${coords}`;
  }

  const codigo = String(data.codigo ?? '').trim();
  if (!codigo) {
    toast.error('El presupuesto no tiene código comercial; no se puede generar el PDF.');
    return;
  }
  const fechaIso = new Date().toISOString().slice(0, 10);
  const nombreArchivo = buildNombreArchivoPresupuestoComercial(
    codigo,
    cliente.nombre || 'Cliente',
    fechaIso,
  );

  const datos = presupuestoApiToDatosPresupuesto(data, {
    cliente: {
      nombre: cliente.nombre,
      dni_cuit: cliente.dni ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      condicionIva: 'Consumidor Final',
    },
    linkUbicacion,
    nombreArchivo,
    docId: codigo,
    fecha: fechaIso,
  });

  await imprimirPresupuestoArgentino(datos);
}

/** Misma carga que descarga/imprimir; abre ventana de vista previa sin disparar print(). */
export async function previsualizarPresupuestoPdf(
  presupuestoId: string,
  cliente: PresupuestoPdfCliente,
): Promise<void> {
  toast.info('Cargando presupuesto...');
  const data = (await get<PresupuestoApiPayload>(`/api/presupuestos/${presupuestoId}`)) as PresupuestoApiPayload;

  let linkUbicacion: string | undefined;
  if (cliente.coordenadas) {
    const coords = cliente.coordenadas.replace(/\s/g, '');
    linkUbicacion = `https://www.google.com/maps?q=${coords}`;
  }

  const codigo = String(data.codigo ?? '').trim();
  if (!codigo) {
    toast.error('El presupuesto no tiene código comercial; no se puede generar la vista previa.');
    return;
  }
  const fechaIso = new Date().toISOString().slice(0, 10);
  const nombreArchivo = buildNombreArchivoPresupuestoComercial(
    codigo,
    cliente.nombre || 'Cliente',
    fechaIso,
  );

  const datos = presupuestoApiToDatosPresupuesto(data, {
    cliente: {
      nombre: cliente.nombre,
      dni_cuit: cliente.dni ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      condicionIva: 'Consumidor Final',
    },
    linkUbicacion,
    nombreArchivo,
    docId: codigo,
    fecha: fechaIso,
  });

  await previsualizarPresupuestoArgentino(datos);
}

/** Código o correlativo para asunto / nombre de archivo cuando falta `codigo` comercial. */
export function resolveCodigoPresupuestoDisplay(data: PresupuestoApiPayload): string {
  const c = String(data.codigo ?? '').trim();
  if (c) return c;
  const cg = data.correlativo_global ?? data.meta?.correlativo_global;
  const n = Number(cg);
  if (Number.isFinite(n) && n > 0) return String(Math.floor(n)).padStart(6, '0');
  return 'sin-código';
}

export function formatFechaAsuntoPresupuestoAR(date: Date = new Date()): string {
  return date.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Asunto tipo: Presupuesto P00001 Martín Astorga 07/04/2026 */
export function buildPresupuestoEmailSubject(opts: {
  codigoDisplay: string;
  nombreCliente: string;
  fecha?: Date;
}): string {
  const nombre = sanitizeClienteNombreArchivo(opts.nombreCliente);
  const cod = String(opts.codigoDisplay || '').trim() || 'sin-código';
  const fecha = formatFechaAsuntoPresupuestoAR(opts.fecha);
  return `Presupuesto ${cod} ${nombre} ${fecha}`;
}

let pdfFileExportInProgress = false;

function renderPresupuestoHtmlInHiddenIframe(html: string): Promise<{
  iframe: HTMLIFrameElement;
  doc: Document;
}> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:794px;min-height:400px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      reject(new Error('Sin documento en iframe'));
      return;
    }
    const htmlWithBase = html.includes('<head>')
      ? html.replace('<head>', `<head><base href="${window.location.origin}/">`)
      : html;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      iframe.removeEventListener('load', onLoad);
      resolve({ iframe, doc });
    };

    const onLoad = () => finish();

    iframe.addEventListener('load', onLoad);
    doc.open();
    doc.write(htmlWithBase);
    doc.close();

    if (doc.readyState === 'complete') finish();
  });
}

/**
 * Misma tubería visual que imprimir; guarda archivo PDF (html2canvas + jsPDF).
 * @returns metadatos útiles para mailto (asunto); no abrir mailto si esto lanza.
 */
export async function downloadPresupuestoPdfFile(
  presupuestoId: string,
  cliente: PresupuestoPdfCliente,
): Promise<{ codigoDisplay: string }> {
  if (typeof window === 'undefined' || !document.body) {
    throw new Error('DOM no disponible');
  }
  if (pdfFileExportInProgress) {
    toast.warning('Ya hay una exportación PDF en curso.');
    throw new Error('PDF_EN_PROGRESO');
  }

  pdfFileExportInProgress = true;
  let iframe: HTMLIFrameElement | null = null;

  try {
    const data = (await get<PresupuestoApiPayload>(
      `/api/presupuestos/${presupuestoId}`,
    )) as PresupuestoApiPayload;

    let linkUbicacion: string | undefined;
    if (cliente.coordenadas) {
      const coords = cliente.coordenadas.replace(/\s/g, '');
      linkUbicacion = `https://www.google.com/maps?q=${coords}`;
    }

    const codigoDisplay = resolveCodigoPresupuestoDisplay(data);
    const fechaIso = new Date().toISOString().slice(0, 10);
    const codigoStr = String(data.codigo ?? '').trim();
    const nombreArchivo = buildNombreArchivoPresupuestoComercial(
      codigoDisplay,
      cliente.nombre || 'Cliente',
      fechaIso,
    );

    const datos = presupuestoApiToDatosPresupuesto(data, {
      cliente: {
        nombre: cliente.nombre,
        dni_cuit: cliente.dni ?? '',
        direccion: cliente.direccion ?? '',
        telefono: cliente.telefono ?? '',
        condicionIva: 'Consumidor Final',
      },
      linkUbicacion,
      nombreArchivo,
      docId: codigoStr || codigoDisplay,
      fecha: fechaIso,
    });

    const datosConImg = await datosPresupuestoConBannersIncrustados(datos);
    const html = buildPresupuestoArgentinoHtml(datosConImg);

    const { iframe: frame, doc } = await renderPresupuestoHtmlInHiddenIframe(html);
    iframe = frame;

    const body = doc.body;
    await waitForImages(body);
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });

    const bannerSrc = getBannerImageSrcForTiles(body, datosConImg.encabezadoPdfUrl);
    injectPdfMarmolesImageTiles(doc, body, bannerSrc);
    if (doc.querySelector('.pdf-marmoles-tile-layer')) {
      await waitForImages(doc.querySelector('.pdf-marmoles-tile-layer')!);
    }

    const exportScale = Math.min(3, Math.max(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 1.6));
    const canvas = await html2canvas(body, {
      scale: exportScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: body.scrollWidth,
      height: body.scrollHeight,
      windowWidth: body.scrollWidth,
      windowHeight: body.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.96);
    // El documento trae el fondo A4 completo (body / PDF_MARMOLES) ya pintado en el canvas: no
    // superponer otra franja encima (evita doble encabezado/pie y refleja fiel el HTML).
    const pageStep = pageHeight - 2; // solape mínimo entre “páginas” del JPEG largo
    let y = 0;
    const pages = Math.max(1, Math.ceil(imgHeight / pageStep));
    for (let i = 0; i < pages; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
      y -= pageStep;
    }

    pdf.save(nombreArchivo);
    return { codigoDisplay };
  } finally {
    if (iframe?.parentNode) iframe.parentNode.removeChild(iframe);
    pdfFileExportInProgress = false;
  }
}
