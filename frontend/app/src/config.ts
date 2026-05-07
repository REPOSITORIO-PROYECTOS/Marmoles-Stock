const IS_TEST = typeof window === 'undefined' || (import.meta as any)?.env?.MODE === 'test';
const IS_DEV = !!(import.meta as any)?.env?.DEV;
const ENV_BASE = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL: string = (() => {
  if (IS_TEST) return '';
  if (IS_DEV) return '';
  if (typeof ENV_BASE !== 'undefined' && ENV_BASE) return ENV_BASE;
  return '';
})();
