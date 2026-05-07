import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmarPagos } from '../../pages/finanzas/ConfirmarPagos';
import * as api from '../../api';
import * as finanzasApi from '../../lib/finanzas/api';

// Mock the API modules
vi.mock('../../api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../../lib/finanzas/api', () => ({
  getDashboardStats: vi.fn(),
  registrarPago: vi.fn(),
}));

describe('ConfirmarPagos Integration', () => {
  const mockPresupuestos = [
    {
      id: 'pres-1',
      cliente_id: 'cli-1',
      cliente_nombre: 'Cliente Test',
      total: 1000,
      observaciones: 'Test obs',
      estado_pago: 'pendiente',
      monto_cobrado: 0,
      aceptado_venta: true,
    }
  ];

  const mockStats = {
    total_presupuestado: 1000,
    total_recaudado: 0,
    total_pendiente: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as any).mockResolvedValue(mockPresupuestos);
    (finanzasApi.getDashboardStats as any).mockResolvedValue(mockStats);
  });

  it('debe cargar y mostrar los presupuestos y KPIs', async () => {
    render(<ConfirmarPagos />);

    // Verificar que muestra el estado de carga
    expect(screen.getByText(/Cargando Mesa de Control/i)).toBeInTheDocument();

    // Esperar a que carguen los datos
    await waitFor(() => {
      expect(screen.getByText('Cliente Test')).toBeInTheDocument();
    });  // Verificar KPIs - Usamos getAll porque el monto puede aparecer en varios KPI y en la lista
    expect(screen.getAllByText(/1[.,\s]000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Cobertura: 0.0%/i)).toBeInTheDocument();
  });

  it('debe abrir el diálogo de pago al hacer clic en Registrar Pago', async () => {
    render(<ConfirmarPagos />);

    await waitFor(() => {
      expect(screen.getByText(/Registrar Pago/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Registrar Pago/i));

    expect(screen.getByText(/Total Presupuestado/i)).toBeInTheDocument();
    // En la UI de shadcn/Card el número y el símbolo pueden estar en nodos diferentes o con espacios
    expect(screen.getAllByText(/1[.,\s]000/).length).toBeGreaterThan(0);
  });
});
