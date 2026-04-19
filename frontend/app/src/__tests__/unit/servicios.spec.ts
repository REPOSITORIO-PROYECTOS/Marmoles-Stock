import { describe, it, expect } from 'vitest';

const servicios = [
  { key: 'instalacion', tarifa: 20000 },
  { key: 'traslado', tarifa: 15000 },
  { key: 'sellado', tarifa: 8000 },
];

function totalServicios(sel: Record<string, boolean>) {
  return Object.keys(sel).filter(k => sel[k]).reduce((s, k) => s + (servicios.find(sv => sv.key === k)?.tarifa || 0), 0);
}

describe('totalServicios', () => {
  it('suma correctamente', () => {
    const sel = { instalacion: true, traslado: false, sellado: true };
    expect(totalServicios(sel)).toBe(28000);
  });
  it('sin seleccion da 0', () => {
    expect(totalServicios({})).toBe(0);
  });
});

