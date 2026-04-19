import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmarPagos } from '../../pages/finanzas/ConfirmarPagos';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as api from '../../api';
import * as finanzasApi from '../../lib/finanzas/api';

// Mock de la API
vi.mock('../../api', () => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(), 
}));

vi.mock('../../lib/finanzas/api', () => ({
  getDashboardStats: vi.fn(),
  registrarPago: vi.fn(),
  getPagosPresupuesto: vi.fn(),
}));

describe('ConfirmarPagos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe mostrar mensaje cuando no hay pagos pendientes', async () => {
    (api.get as any).mockResolvedValue([]);
    
    render(<ConfirmarPagos />);
    
    await waitFor(() => {
      expect(screen.getByText(/No se encontraron resultados/i)).toBeInTheDocument();
    });
  });

  it('debe listar presupuestos correctamente', async () => {
    const pagosMock = [
      {
        id: 'pres-123',
        cliente_id: 'CLI-001',
        cliente_nombre: 'Cliente Test',
        total: 50000,
        estado_pago: 'pendiente',
        monto_cobrado: 0,
        observaciones: 'Test'
      }
    ];
    (api.get as any).mockResolvedValue(pagosMock);

    render(<ConfirmarPagos />);

    await waitFor(() => {
      expect(screen.getByText(/Cliente Test/i)).toBeInTheDocument();
      expect(screen.getAllByText(/50\.000/).length).toBeGreaterThan(0);
    });
  });

  it('debe confirmar un pago y crear orden de producción al hacer clic', async () => {
    const pagosMock = [
      {
        id: 'pres-123',
        cliente_id: 'CLI-001',
        cliente_nombre: 'Cliente Test',
        total: 50000,
        estado_pago: 'pendiente',
        monto_cobrado: 0,
        observaciones: 'Test',
        aceptado_venta: true
      }
    ];
    (api.get as any).mockResolvedValue(pagosMock);
    (finanzasApi.registrarPago as any).mockResolvedValue({ id: 'pago-123', estado: 'confirmado' });

    render(<ConfirmarPagos />);

    // Esperar a que cargue
    await waitFor(() => {
      expect(screen.getByText(/Cliente Test/i)).toBeInTheDocument();
    });

    // Clic en Registrar Pago (abre modal)
    const btnRegistrar = screen.getByRole('button', { name: /Registrar Pago/i });
    fireEvent.click(btnRegistrar);

    // Verificar modal PagoDialog abierto
    await waitFor(() => expect(screen.getByText(/Monto a Pagar/i)).toBeInTheDocument());

    // Completar monto
    const inputMonto = screen.getByLabelText(/Monto a Pagar/i);
    fireEvent.change(inputMonto, { target: { value: '10000' } });

    // Clic en registrar final
    const btnFinal = screen.getByRole('button', { name: /Confirmar Pago/i });
    fireEvent.click(btnFinal);

    // Verificar llamada a API (registrarPago se llama desde PagoDialog)
    await waitFor(() => {
      expect(finanzasApi.registrarPago).toHaveBeenCalledWith(expect.objectContaining({
        presupuesto_id: 'pres-123',
        monto: 10000
      }));
    });
  });
});
