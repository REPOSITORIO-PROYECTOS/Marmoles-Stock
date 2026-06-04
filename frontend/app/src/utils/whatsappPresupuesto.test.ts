import { describe, it, expect } from 'vitest';
import {
  normalizeWhatsAppNumberAr,
  buildPresupuestoWhatsAppMessage,
  buildPresupuestoEnvioClienteMensaje,
} from './whatsappPresupuesto';

describe('normalizeWhatsAppNumberAr', () => {
  it('mantiene número ya con prefijo 54', () => {
    expect(normalizeWhatsAppNumberAr('54 9 264 1234567')).toBe('5492641234567');
  });

  it('anteponer 549 a número provincial típico de 10 dígitos', () => {
    expect(normalizeWhatsAppNumberAr('2641234567')).toBe('5492641234567');
  });

  it('elimina ceros iniciales', () => {
    expect(normalizeWhatsAppNumberAr('02641234567')).toBe('5492641234567');
  });

  it('retorna null si vacío', () => {
    expect(normalizeWhatsAppNumberAr('')).toBeNull();
    expect(normalizeWhatsAppNumberAr('abc')).toBeNull();
  });
});

describe('buildPresupuestoWhatsAppMessage', () => {
  it('no incluye montos', () => {
    const t = buildPresupuestoWhatsAppMessage({
      nombreCliente: 'Ana',
      correlativo: 7,
    });
    expect(t).toContain('Ana');
    expect(t).toContain('#000007');
    expect(t).not.toMatch(/\$\s*\d/);
    expect(t).not.toMatch(/total/i);
  });
});

describe('buildPresupuestoEnvioClienteMensaje', () => {
  it('incluye nombre y firma', () => {
    const t = buildPresupuestoEnvioClienteMensaje('Martín');
    expect(t).toContain('Estimado Martín');
    expect(t).toContain('MUNDO DI MARMI');
    expect(t).toContain('presupuesto solicitado');
  });

  it('sin nombre usa cliente', () => {
    const t = buildPresupuestoEnvioClienteMensaje('  ');
    expect(t).toContain('Estimado cliente');
  });
});
