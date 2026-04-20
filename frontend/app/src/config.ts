const IS_TEST = typeof window === 'undefined' || (import.meta as any)?.env?.MODE === 'test';
const IS_DEV = !!(import.meta as any)?.env?.DEV;
const ENV_BASE = import.meta.env.VITE_API_BASE_URL;

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

/** Base URL del API. En dev: si existe VITE_API_BASE_URL se usa (p. ej. backend Docker en :8020); si no, '' + proxy Vite → mismo host que el frontend. */
export const API_BASE_URL: string = (() => {
  if (IS_TEST) return '';
  const fromEnv = typeof ENV_BASE === 'string' ? ENV_BASE.trim() : '';
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (IS_DEV) return '';
  return typeof window !== 'undefined' ? window.location.origin : '';
})();
