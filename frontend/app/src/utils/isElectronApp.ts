declare global {
  interface Window {
    electronApp?: { version?: string; platform?: string };
  }
}

/** True cuando la UI corre dentro del instalador Electron (no en el navegador). */
export function isElectronApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.electronApp) return true;
  return /Electron/i.test(window.navigator.userAgent);
}
