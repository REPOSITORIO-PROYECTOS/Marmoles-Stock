import jsPDF from 'jspdf';
import {
  fetchPdfMarmolesDataUrl,
  pdfMarmolesFooterBandMm,
  pdfMarmolesHeaderBandMm,
  rasterizePdfMarmolesStripFromDataUrl,
} from './pdfMarmolesLayout';

export type PlanoTecnicoPdfClienteInfo = {
  clienteNombre: string;
  direccion?: string;
  coordenadas?: string;
  /** Línea opcional (p. ej. material de la visita). */
  material?: string;
};

function loadImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo leer la imagen del plano'));
    img.src = dataUrl;
  });
}

function fitInRect(natW: number, natH: number, maxW: number, maxH: number): { w: number; h: number } {
  if (!natW || !natH) return { w: maxW, h: maxH };
  const s = Math.min(maxW / natW, maxH / natH);
  return { w: natW * s, h: natH * s };
}

/**
 * PDF horizontal A4: franjas PDF_MARMOLES + plano(s) escalado al área útil.
 */
export async function savePlanoTecnicoLandscapePdf(opts: {
  anexosImagenes: string[];
  cliente: PlanoTecnicoPdfClienteInfo;
  fileBaseName: string;
}): Promise<void> {
  const { anexosImagenes, cliente, fileBaseName } = opts;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerH = pdfMarmolesHeaderBandMm;
  const footerH = pdfMarmolesFooterBandMm;
  const sideMargin = 8;
  const gap = 3;

  const marmolesData =
    typeof window !== 'undefined' ? await fetchPdfMarmolesDataUrl(window.location.origin) : null;
  let headerPng: string | null = null;
  let footerPng: string | null = null;
  if (marmolesData) {
    [headerPng, footerPng] = await Promise.all([
      rasterizePdfMarmolesStripFromDataUrl(marmolesData, 'header'),
      rasterizePdfMarmolesStripFromDataUrl(marmolesData, 'footer'),
    ]);
  }

  const paintBands = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, headerH, 'F');
    doc.rect(0, pageHeight - footerH, pageWidth, footerH, 'F');
    if (headerPng) {
      doc.addImage(headerPng, 'PNG', 0, 0, pageWidth, headerH, undefined, 'FAST');
    }
    if (footerPng) {
      doc.addImage(footerPng, 'PNG', 0, pageHeight - footerH, pageWidth, footerH, undefined, 'FAST');
    }
  };

  const drawPageHeaderText = (yStart: number) => {
    let y = yStart;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('PLANO TÉCNICO CON LARGO Y ANCHO', sideMargin, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Cliente: ${cliente.clienteNombre}`, sideMargin, y);
    y += 5;
    doc.text(`Dirección: ${cliente.direccion || 'No especificada'}`, sideMargin, y);
    if (cliente.coordenadas) {
      y += 5;
      doc.text(`Ubicación: ${cliente.coordenadas}`, sideMargin, y);
    }
    if (cliente.material) {
      y += 5;
      doc.text(`Material: ${cliente.material}`, sideMargin, y);
    }
    return y + 4;
  };

  const plotBottom = pageHeight - footerH - gap - 6;
  const maxPlotW = pageWidth - 2 * sideMargin;

  paintBands();
  let contentBottomY = drawPageHeaderText(headerH + gap);
  doc.setDrawColor(200);
  doc.line(sideMargin, contentBottomY, pageWidth - sideMargin, contentBottomY);
  let plotTop = contentBottomY + 4;

  if (anexosImagenes.length === 0) {
    doc.setFontSize(10);
    doc.text('No hay planos técnicos disponibles', sideMargin, plotTop + 6);
  } else {
    for (let i = 0; i < anexosImagenes.length; i += 1) {
      const imgData = anexosImagenes[i];
      if (i > 0) {
        doc.addPage();
        paintBands();
        contentBottomY = drawPageHeaderText(headerH + gap);
        doc.setDrawColor(200);
        doc.line(sideMargin, contentBottomY, pageWidth - sideMargin, contentBottomY);
        plotTop = contentBottomY + 4;
      }
      let nat = { w: 800, h: 600 };
      try {
        nat = await loadImageSize(imgData);
      } catch {
        /* usar fallback */
      }
      const maxPlotH = Math.max(20, plotBottom - plotTop);
      const { w: drawW, h: drawH } = fitInRect(nat.w, nat.h, maxPlotW, maxPlotH);
      const x0 = sideMargin + (maxPlotW - drawW) / 2;
      const y0 = plotTop + (maxPlotH - drawH) / 2;
      doc.addImage(imgData, 'PNG', x0, y0, drawW, drawH);
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Generado: ${new Date().toLocaleString()}`, sideMargin, pageHeight - footerH - 4, {
    align: 'left',
  });

  doc.save(`${fileBaseName}_${new Date().toISOString().split('T')[0]}.pdf`);
}
