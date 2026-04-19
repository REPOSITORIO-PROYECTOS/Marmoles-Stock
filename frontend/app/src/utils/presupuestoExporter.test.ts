/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imprimirPresupuestoArgentino, DatosPresupuesto } from './presupuestoExporter';

describe('imprimirPresupuestoArgentino', () => {
  const baseDatos: DatosPresupuesto = {
    id: 'P-TEST',
    fecha: '01/02/2026',
    cliente: {
      nombre: 'Cliente Test',
      dni_cuit: '20-12345678-9',
      direccion: 'Calle 123',
      telefono: '264-0000000',
      condicionIva: 'Consumidor Final'
    },
    empresa: {
      nombre: 'JF Mármoles',
      cuit: '20-XXXXXXXX-X',
      direccion: 'San Juan'
    },
    items: [
      { detalle: 'Granito', medidas: 'Según plano', cantidad: 2, precioUnitario: 100, total: 200 }
    ],
    total: 200,
    observaciones: 'Test obs'
  };

  let writeSpy: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeSpy = vi.fn();
    openSpy = vi.fn(() => ({
      document: {
        open: vi.fn(),
        write: writeSpy,
        close: vi.fn()
      }
    })) as any;
    (globalThis as any).window = {
      open: openSpy
    };
    (globalThis as any).document = {};
  });

  it('incluye la sección ANEXO cuando hay imágenes de planos', () => {
    const datos: DatosPresupuesto = {
      ...baseDatos,
      anexosImagenes: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB']
    };
    imprimirPresupuestoArgentino(datos);
    expect(openSpy).toHaveBeenCalled();
    const html = writeSpy.mock.calls[0][0] as string;
    expect(html).toContain('ANEXO 1 - Planos de Corte');
    expect(html).toContain('data:image/png;base64,AAA');
    expect(html).toContain('data:image/png;base64,BBB');
  });

  it('no incluye ANEXO si no hay imágenes', () => {
    imprimirPresupuestoArgentino(baseDatos);
    const html = writeSpy.mock.calls[0][0] as string;
    expect(html).not.toContain('ANEXO 1 - Planos de Corte');
  });
});
