/** Layout de la lámina A4 en [PDF_MARMOLES.svg](public/PDF_MARMOLES.svg): viewBox 595×842. */

export const PDF_MARMOLES_VIEWBOX_W = 595;
export const PDF_MARMOLES_VIEWBOX_H = 842;
/** Franja superior del arte (unidades del viewBox). */
export const PDF_MARMOLES_HEADER_STRIP = 95;
/** Franja inferior del arte (~110 en el diseño). */
export const PDF_MARMOLES_FOOTER_STRIP = 110;

const A4_HEIGHT_MM = 297;

/** Altura de franja superior en mm (A4 portrait). */
export const pdfMarmolesHeaderBandMm =
  (PDF_MARMOLES_HEADER_STRIP / PDF_MARMOLES_VIEWBOX_H) * A4_HEIGHT_MM;

/** Altura de franja inferior en mm (A4 portrait). */
export const pdfMarmolesFooterBandMm =
  (PDF_MARMOLES_FOOTER_STRIP / PDF_MARMOLES_VIEWBOX_H) * A4_HEIGHT_MM;

export const PDF_MARMOLES_SVG_PUBLIC_PATH = '/PDF_MARMOLES.svg';

export type PdfMarmolesStripKind = 'header' | 'footer';

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen del banner'));
    img.src = dataUrl;
  });
}

function isFullPageLikeBanner(img: HTMLImageElement): boolean {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return false;
  const ratio = h / w;
  const pageRatio = PDF_MARMOLES_VIEWBOX_H / PDF_MARMOLES_VIEWBOX_W;
  return ratio >= pageRatio * 0.88;
}

/**
 * Recorta la franja superior o inferior de una lámina tipo PDF_MARMOLES, o devuelve el PNG
 * completo si el asset es un banner legacy (franja ya recortada).
 */
export async function rasterizePdfMarmolesStripFromDataUrl(
  imageDataUrl: string,
  kind: PdfMarmolesStripKind,
): Promise<string | null> {
  if (!imageDataUrl.trim()) return null;
  try {
    const img = await loadImageFromDataUrl(imageDataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (!isFullPageLikeBanner(img)) {
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    }

    const stripH =
      kind === 'header'
        ? Math.round((h * PDF_MARMOLES_HEADER_STRIP) / PDF_MARMOLES_VIEWBOX_H)
        : Math.round((h * PDF_MARMOLES_FOOTER_STRIP) / PDF_MARMOLES_VIEWBOX_H);

    canvas.width = w;
    canvas.height = Math.max(1, stripH);

    if (kind === 'header') {
      ctx.drawImage(img, 0, 0, w, stripH, 0, 0, w, stripH);
    } else {
      const sy = Math.max(0, h - stripH);
      ctx.drawImage(img, 0, sy, w, stripH, 0, 0, w, stripH);
    }

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function fetchPdfMarmolesDataUrl(origin: string): Promise<string | null> {
  const base = String(origin).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}${PDF_MARMOLES_SVG_PUBLIC_PATH}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
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
