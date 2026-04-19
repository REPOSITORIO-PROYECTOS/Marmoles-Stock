import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

if (!(globalThis as any).matchMedia) {
  (globalThis as any).matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}
if (!(globalThis as any).scrollTo) {
  (globalThis as any).scrollTo = vi.fn();
}
if (!(globalThis as any).window) {
  (globalThis as any).window = {} as any;
}
if (!(globalThis as any).window.open) {
  (globalThis as any).window.open = vi.fn(() => ({
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn()
    }
  })) as any;
}

if (typeof window !== 'undefined') {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => { };
  }
  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = () => { };
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => { };
  }
}
