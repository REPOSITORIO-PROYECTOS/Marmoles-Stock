import type { Pago } from './api';

export interface ReciboPagoPrintContext {
  pago: Pago;
  clienteNombre: string;
  presupuestoDisplay: string;
  empresaNombre?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFecha(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function metodoLabel(m: string): string {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
    cheque: 'Cheque',
  };
  return map[m] || m;
}

/**
 * Abre una ventana con constancia de pago interna A4 lista para imprimir (no reemplaza documentación fiscal).
 */
export function openReciboPagoPrint(ctx: ReciboPagoPrintContext): void {
  if (typeof window === 'undefined') return;
  const { pago, clienteNombre, presupuestoDisplay, empresaNombre = 'Mármoles' } = ctx;
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Constancia de pago</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 4px 0;
      font-weight: 700;
    }
    .muted { color: #555; font-size: 12px; margin-bottom: 20px; }
    .box {
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .label { color: #444; }
    .value { font-weight: 600; text-align: right; }
    .monto { font-size: 22px; font-weight: 800; color: #0f172a; }
    .legal { font-size: 10px; color: #666; margin-top: 28px; line-height: 1.4; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Constancia de pago</h1>
  <p class="muted">${escapeHtml(empresaNombre)} · No válido como factura</p>
  <div class="box">
    <div class="row"><span class="label">Presupuesto</span><span class="value">${escapeHtml(presupuestoDisplay)}</span></div>
    <div class="row"><span class="label">Cliente</span><span class="value">${escapeHtml(clienteNombre)}</span></div>
    <div class="row"><span class="label">Fecha</span><span class="value">${escapeHtml(formatFecha(pago.fecha))}</span></div>
    <div class="row"><span class="label">Método</span><span class="value">${escapeHtml(metodoLabel(pago.metodo_pago))}</span></div>
    ${pago.referencia ? `<div class="row"><span class="label">Referencia</span><span class="value">${escapeHtml(pago.referencia)}</span></div>` : ''}
    ${pago.nota ? `<div class="row"><span class="label">Nota</span><span class="value">${escapeHtml(pago.nota)}</span></div>` : ''}
  </div>
  <div class="box">
    <div class="row"><span class="label">Monto abonado</span></div>
    <p class="monto">$ ${Number(pago.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
  </div>
  <p class="legal">Documento de uso interno para registrar un pago asociado al presupuesto indicado. Conserve una copia junto con la documentación del cliente.</p>
  <script>window.onload = function() { window.focus(); window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
