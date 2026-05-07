/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresupuestoSimple } from './usePresupuestoSimple';

// Mocks globales
(globalThis as any).scrollTo = vi.fn();
(globalThis as any).toast = {
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
};

describe('usePresupuestoSimple - guardarPresupuestoYLead', () => {
  it('bloquea guardar cuando total es 0', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: { get: () => 'application/json' }
    });

    const { result } = renderHook(() => usePresupuestoSimple());

    await act(async () => {
      result.current.setCliente('c1');
      // En lugar de setSeleccion directo, usamos el estado interno si fuera necesario, 
      // pero como no está exportado, probamos que el total sea 0 inicialmente.
      result.current.setExtras([]);
    });

    expect(result.current.calcularTotal()).toBe(0);

    let res;
    await act(async () => {
      res = await result.current.guardarPresupuestoYLead();
    });

    expect(res).toBe(false);
  });

  it('permite guardar cuando total > 0', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'P-1' }),
      headers: { get: () => 'application/json' }
    });

    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (url.includes('/api/materiales')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'm1', nombre: 'Granito', precio_m2: 100 }],
          headers: { get: () => 'application/json' }
        });
      }
      if (url.includes('/api/inventario/stock-detallado')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
          headers: { get: () => 'application/json' }
        });
      }
      if (url.includes('/api/clientes')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            id: 'c1',
            nombre: 'Cliente Test',
            direccion: 'Calle 1',
            coordenadas: '-31.5373, -68.5252',
            place_id: 'osm:-31.537300:-68.525200'
          }],
          headers: { get: () => 'application/json' }
        });
      }
      if (url.includes('/api/presupuestos') && init?.method === 'POST') {
        return mockPost();
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
        headers: { get: () => 'application/json' }
      });
    });

    const { result } = renderHook(() => usePresupuestoSimple());

    // Esperar a que carguen los materiales y clientes
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    await act(async () => {
      result.current.setCliente('c1');
    });

    await act(async () => {
      await result.current.seleccionarMaterial('m1');
    });

    await act(async () => {
      result.current.actualizarDiseño([], 2, []);
      result.current.setExtras([{ id: 'e1', nombre: 'Zócalos ml', precio: 1000, cantidad: 1 }]);
    });

    let res;
    await act(async () => {
      res = await result.current.guardarPresupuestoYLead();
    });

    expect(res).not.toBe(false);
    expect(mockPost).toHaveBeenCalled();
  });

  it('envia descuento e IVA en payload y guarda respuesta del presupuesto', async () => {
    const fetchMock = vi.fn().mockImplementation((url, init) => {
      if (url.includes('/api/materiales')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'm1', nombre: 'Granito', precio_m2: 1200 }],
          headers: { get: () => 'application/json' }
        });
      }
      if (url.includes('/api/clientes')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            id: 'c1',
            nombre: 'Cliente Test',
            direccion: 'Calle 1',
            coordenadas: '-31.5373, -68.5252',
            place_id: 'osm:-31.537300:-68.525200'
          }],
          headers: { get: () => 'application/json' }
        });
      }
      if (url.includes('/api/inventario/stock-detallado')) {
        return Promise.resolve({ ok: true, json: async () => [], headers: { get: () => 'application/json' } });
      }
      if (url.includes('/api/presupuestos') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'P-XYZ', correlativo_global: 42, subtotal_neto: 1000, iva_monto: 210, total_final: 1210 }),
          headers: { get: () => 'application/json' }
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}), headers: { get: () => 'application/json' } });
    });

    globalThis.fetch = fetchMock as any;

    const { result } = renderHook(() => usePresupuestoSimple());

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      result.current.setCliente('c1');
    });

    await act(async () => {
      await result.current.seleccionarMaterial('m1');
    });

    await act(async () => {
      result.current.setPaymentInfo({
        tipoCobro: 'contado',
        conFactura: true,
        plazoPagoCatalogoId: null,
        condicionesPagoTexto: '',
        descuento: {
          catalogoId: 'b1111111-1111-4111-8111-111111111111',
          tipo: 'porcentaje',
          valor: 10
        }
      });
      result.current.actualizarDiseño([], 2, []);
      result.current.setExtras([{ id: 'e1', nombre: 'Borde', precio: 200, cantidad: 1 }]);
    });

    await act(async () => {
      await result.current.guardarPresupuestoYLead();
    });

    const postCall = fetchMock.mock.calls.find((c: any[]) => String(c[0]).includes('/api/presupuestos') && c[1]?.method === 'POST');
    expect(postCall).toBeTruthy();
    const sentBody = JSON.parse(postCall[1].body);
    expect(sentBody.iva_tasa).toBe(0.21);
    expect(sentBody.descuento_id).toBe('b1111111-1111-4111-8111-111111111111');
    expect(sentBody.descuento_valor).toBe(0);
    expect(sentBody.place_id).toBeTruthy();
    expect(result.current.ultimoPresupuesto?.correlativo_global).toBe(42);
  });
});

