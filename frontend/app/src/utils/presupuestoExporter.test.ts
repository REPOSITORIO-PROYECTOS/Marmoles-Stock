/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  imprimirPresupuestoArgentino,
  previsualizarPresupuestoArgentino,
  datosPresupuestoConBannersIncrustados,
  DatosPresupuesto,
} from './presupuestoExporter';

const baseDatos: DatosPresupuesto = {
  id: 'P-TEST',
  fecha: '01/02/2026',
  cliente: {
    nombre: 'Cliente Test',
    dni_cuit: '20-12345678-9',
    direccion: 'Calle 123',
    telefono: '264-0000000',
    condicionIva: 'Consumidor Final',
  },
  empresa: {
    nombre: 'JF Mármoles',
    cuit: '20-XXXXXXXX-X',
    direccion: 'San Juan',
  },
  items: [{ detalle: 'Granito', medidas: 'Según plano', cantidad: 2, precioUnitario: 100, total: 200 }],
  total: 200,
  observaciones: 'Test obs',
};

describe('datosPresupuestoConBannersIncrustados', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('incrusta encabezado y pie como data URL cuando fetch responde OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0xd, 0xa, 0x1a, 0xa)], { type: 'image/png' })),
      }),
    );

    const out = await datosPresupuestoConBannersIncrustados(baseDatos);
    expect(out.encabezadoPdfUrl?.startsWith('data:image/png;base64,')).toBe(true);
    expect(out.piePdfUrl?.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('imprimirPresupuestoArgentino', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        blob: () => Promise.resolve(new Blob()),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('no lanza si la ventana de impresión no está disponible', async () => {
    await expect(imprimirPresupuestoArgentino(baseDatos)).resolves.toBeUndefined();
  });

  it('vista previa no lanza si la ventana no está disponible', async () => {
    await expect(previsualizarPresupuestoArgentino(baseDatos)).resolves.toBeUndefined();
  });
});
