import { PDF_MARMOLES_VIEWBOX_H, PDF_MARMOLES_VIEWBOX_W } from './pdfMarmolesLayout';

/**
 * Superpone mosaico de A4 (595/842) con <img> bajo el contenido (z-index 0).
 * Sirve para:
 * - impresión: los navegadores suelen no imprimir `background-image` de body;
 * - html2canvas: tampoco pinta bien esos fondos.
 * Anula el fondo CSS en `body` para no duplicar.
 */
export function injectPdfMarmolesImageTiles(doc: Document, body: HTMLElement, imageUrl: string): void {
  doc.querySelectorAll('.pdf-marmoles-tile-layer').forEach((el) => el.remove());
  if (!imageUrl.trim()) {
    return;
  }

  const w0 = body.clientWidth;
  const w1 = doc.documentElement?.clientWidth ?? 0;
  const w = w0 > 0 ? w0 : w1 > 0 ? w1 : 794;
  const pageH = (w * PDF_MARMOLES_VIEWBOX_H) / PDF_MARMOLES_VIEWBOX_W;
  const n = Math.max(1, Math.ceil(body.scrollHeight / pageH) + 1);

  const layer = doc.createElement('div');
  layer.className = 'pdf-marmoles-tile-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:absolute;left:0;right:0;top:0;z-index:0;pointer-events:none;width:100%;' +
    'line-height:0;overflow:visible;';

  for (let i = 0; i < n; i += 1) {
    const im = doc.createElement('img');
    im.src = imageUrl;
    im.alt = '';
    im.decoding = 'async';
    im.setAttribute('data-marmoles-a4', '1');
    im.style.cssText =
      `display:block;width:100%;height:${String(pageH)}px;` +
      'object-fit:fill;box-sizing:border-box;margin:0;border:0;padding:0;';
    layer.appendChild(im);
  }

  body.insertBefore(layer, body.firstChild);
  body.style.backgroundImage = 'none';
  body.style.setProperty('background', '#ffffff');
}

export function getBannerImageSrcForTiles(body: HTMLElement, encabezadoExplicit?: string): string {
  return (
    encabezadoExplicit?.trim() ||
    body.querySelector<HTMLImageElement>('div.sr-only img')?.src ||
    ''
  );
}
