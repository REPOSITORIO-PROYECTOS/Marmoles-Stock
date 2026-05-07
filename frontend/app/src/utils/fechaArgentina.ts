/**
 * Fechas del backend: típicamente `datetime.utcnow().isoformat()` sin sufijo `Z`.
 * Sin `Z`, ECMAScript interpreta el instante como hora local y desfasa el reloj vs Argentina.
 */

const ISO_LOCAL_NAIVE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function hasExplicitTimeZone(iso: string): boolean {
  return /[zZ]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso) || /[+-]\d{4}$/.test(iso);
}

/** Milisegundos UTC correctos a partir de string/number del API. */
export function parseMsFromBackendFecha(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return Date.now();
    if (!hasExplicitTimeZone(t) && ISO_LOCAL_NAIVE.test(t)) {
      const parsed = Date.parse(`${t}Z`);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const parsed = Date.parse(t);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(t);
    if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  }
  return Date.now();
}

const SOLO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Fecha del presupuesto en PDF: siempre DD/MM/YYYY para lectura local. */
export function formatFechaPresupuestoPdfDisplay(value: string): string {
  const s = value.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  const ymd = SOLO_YMD.exec(s);
  if (ymd) {
    return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
  }
  const ms = parseMsFromBackendFecha(s);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toLocaleDateString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return s;
}

/** Fecha y hora en Argentina (ART) para tarjetas y listas. */
export function formatDateTimeART(ms: number): string {
  return new Date(ms).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
