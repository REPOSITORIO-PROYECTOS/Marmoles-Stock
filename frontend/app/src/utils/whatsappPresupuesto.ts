import { BRAND_LEGAL_NAME } from '../brand';

/**
 * Normalización wa.me para Argentina (spec claude/06_ENVIO_WHATSAPP_PRESUPUESTO.txt).
 * Formato esperado por WhatsApp: código país sin + (ej. 5492641234567).
 */
export function normalizeWhatsAppNumberAr(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (!d) return null;
  while (d.startsWith('0')) d = d.slice(1);
  if (!d) return null;
  if (d.startsWith('54')) return d;
  // Número nacional típico: área (ej. 264) + abonado (6–8 dígitos) → anteponer 549 (móvil)
  if (d.length >= 8 && d.length <= 11) {
    if (d.startsWith('9')) return `54${d}`;
    return `549${d}`;
  }
  return d;
}

/** Texto fijo para envío al cliente (WhatsApp y cuerpo de mail desde modal detalle lead). */
export function buildPresupuestoEnvioClienteMensaje(nombreCliente?: string): string {
  const nombre = (nombreCliente || '').trim();
  const lineaNombre = nombre ? nombre : 'cliente';
  return [
    `Estimado ${lineaNombre}`,
    '',
    'Le enviamos el presupuesto solicitado.',
    '',
    'Por favor confirmar por este medio.',
    '',
    'Muchas Gracias',
    BRAND_LEGAL_NAME,
  ].join('\n');
}

export function buildPresupuestoWhatsAppMessage(opts: {
  nombreCliente?: string;
  correlativo?: number;
  empresaNombre?: string;
}): string {
  const nombre = (opts.nombreCliente || '').trim();
  const emp = (opts.empresaNombre || BRAND_LEGAL_NAME).trim();
  const corr =
    opts.correlativo && opts.correlativo > 0
      ? ` #${String(opts.correlativo).padStart(6, '0')}`
      : '';
  const hola = nombre ? `Hola ${nombre}, ` : 'Hola, ';
  return `${hola}le enviamos su presupuesto${corr} desde ${emp}. Quedamos a disposición. Adjunte el PDF descargado en este chat.`;
}

/** true si se abrió una ventana (puede fallar con bloqueo de pop-ups). */
export function openWhatsAppChat(e164: string, message: string): boolean {
  const url = `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return w != null;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
