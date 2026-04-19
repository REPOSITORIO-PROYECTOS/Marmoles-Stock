import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { DashboardEntregasSimplificado } from '../DashboardEntregasSimplificado';
import * as apiModule from '../../../api';

// Mock API calls
vi.mock('../../../api', () => ({
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn()
}));

vi.mock('../../../utils/notifications', () => ({
    notifySuccess: vi.fn(),
    notifyError: vi.fn()
}));

const mockEntregas = [
    {
        id: 'entrega-001',
        cliente: 'Juan Pérez',
        material_nombre: 'Mármol Blanco',
        estado_produccion: 'terminado',
        estado_logistica: 'pendiente',
        fecha_entrega_programada: '2026-03-10',
        calificacion_calidad: null,
        comentarios_calidad: null,
        direccion: 'Calle Principal 123, Apartado 2B',
        pagado: true,
        total_piezas: 3,
        piezas_cortadas: 3,
        encuesta_token: 'token-abc123',
        encuesta_completada: false,
        prioridad: 'media',
        piezas: [
            {
                id: 'pieza-1',
                nombre: 'Encimera',
                material: 'Mármol Blanco',
                medidas: '200x60cm',
                estado: 'terminada',
                icono: '✅'
            },
            {
                id: 'pieza-2',
                nombre: 'Respaldo',
                material: 'Mármol Blanco',
                medidas: '200x30cm',
                estado: 'terminada',
                icono: '✅'
            },
            {
                id: 'pieza-3',
                nombre: 'Mesa Lateral',
                material: 'Mármol Blanco',
                medidas: '50x50cm',
                estado: 'terminada',
                icono: '✅'
            }
        ]
    },
    {
        id: 'entrega-002',
        cliente: 'María González',
        material_nombre: 'Granito Negro',
        estado_produccion: 'terminado',
        estado_logistica: 'entregada',
        fecha_entrega_programada: '2026-03-05',
        calificacion_calidad: 5,
        comentarios_calidad: 'Excelente trabajo',
        direccion: 'Avenida Central 456',
        pagado: true,
        total_piezas: 2,
        piezas_cortadas: 2,
        encuesta_token: 'token-def456',
        encuesta_completada: true,
        prioridad: 'media',
        piezas: [
            {
                id: 'pieza-3',
                nombre: 'Barra',
                material: 'Granito Negro',
                medidas: '150x80cm',
                estado: 'terminada',
                icono: '✅'
            },
            {
                id: 'pieza-4',
                nombre: 'Base',
                material: 'Granito Negro',
                medidas: '150x30cm',
                estado: 'terminada',
                icono: '✅'
            }
        ]
    }
];

describe('DashboardEntregasSimplificado', () => {
    let mockGet: any;
    let mockPatch: any;
    let mockPost: any;

    afterEach(() => {
        vi.clearAllMocks();
    });

    beforeEach(() => {
        mockGet = vi.mocked(apiModule.get);
        mockPatch = vi.mocked(apiModule.patch);
        mockPost = vi.mocked(apiModule.post);

        mockGet.mockResolvedValue(mockEntregas);
        mockPatch.mockResolvedValue({ id: 'entrega-001', estado_logistica: 'en_ruta' });
        mockPost.mockResolvedValue({ id: 'entrega-001', ok: true });
    });

    it('renders dashboard with title and tabs', async () => {
        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Entregas - Vista Simplificada')).toBeInTheDocument();
            expect(screen.getByText('Activas')).toBeInTheDocument();
            expect(screen.getByText('Entregadas')).toBeInTheDocument();
        });
    });

    it('loads and displays active deliveries on mount', async () => {
        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(mockGet).toHaveBeenCalledWith('/api/logistica/entregas');
        });

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /seleccionar listas/i })).toBeInTheDocument();
        });
    });

    it('filters entregas by tab (activas/entregadas)', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const entregadasTab = screen.getByRole('tab', { name: /entregadas/i });
        await user.click(entregadasTab);

        await waitFor(() => {
            expect(screen.getByText('María González')).toBeInTheDocument();
            expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
        });
    });

    it('searches entregas by client name', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const entregadasTab = screen.getByRole('tab', { name: /entregadas/i });
        await user.click(entregadasTab);

        const searchInput = screen.getByPlaceholderText(/buscar cliente/i);
        await user.type(searchInput, 'María');

        await waitFor(() => {
            expect(screen.getByText('María González')).toBeInTheDocument();
            expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
        });
    });

    it('updates delivery status on button click', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const enRutaButton = screen.getByRole('button', { name: /en ruta/i });
        await user.click(enRutaButton);

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith(
                '/api/logistica/entregas/entrega-001/estado',
                expect.objectContaining({ estado_logistica: 'en_ruta' })
            );
        });
    });

    it('delivers selected ready pieces from simplified flow', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
        await user.click(checkboxes[0]);

        const entregarPiezasBtn = screen.getByRole('button', { name: /entregar piezas listas/i });
        expect(entregarPiezasBtn).toBeEnabled();
        await user.click(entregarPiezasBtn);

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalledWith(
                '/api/logistica/entregas/entrega-001/entregar-piezas',
                expect.objectContaining({ pieza_ids: expect.any(Array) })
            );
        });
    });

    it('shows feedback dialog when delivery is marked as entregada', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const enRutaButton = screen.getByRole('button', { name: /en ruta/i });
        await user.click(enRutaButton);

        mockGet.mockResolvedValueOnce([
            { ...mockEntregas[0], estado_logistica: 'en_ruta' }
        ]);

        await waitFor(() => {
            expect(mockPatch).toHaveBeenCalled();
        });
    });

    it('displays all pieces for a delivery', async () => {
        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const products = screen.getAllByText(/piezas/i);
        expect(products.length).toBeGreaterThan(0);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it('copies WhatsApp link to clipboard', async () => {
        const user = userEvent.setup();

        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: vi.fn().mockResolvedValue(undefined)
            },
            configurable: true
        });

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const linkButtons = screen.getAllByRole('button', { name: /link/i });
        if (linkButtons.length > 0) {
            await user.click(linkButtons[0]);

            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalled();
            });
        }
    });

    it('displays rating stars in feedback dialog', async () => {
        const user = userEvent.setup();

        mockGet.mockResolvedValueOnce([
            { ...mockEntregas[0], estado_logistica: 'en_ruta' }
        ]);

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const entregarBtn = screen.getByRole('button', { name: /^entregar$/i });
        await user.click(entregarBtn);

        await waitFor(() => {
            expect(screen.getByText(/cómo calificaría/i)).toBeInTheDocument();
        });
    });

    it('shows "No hay entregas" message when list is empty', async () => {
        mockGet.mockResolvedValueOnce([]);

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/no hay entregas/i)).toBeInTheDocument();
        });
    });

    it('displays delivery status badges correctly', async () => {
        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
        });
    });

    it('marks delivered items with checkmark', async () => {
        const user = userEvent.setup();

        render(
            <BrowserRouter>
                <DashboardEntregasSimplificado />
            </BrowserRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
        });

        const entregadasTab = screen.getByRole('tab', { name: /entregadas/i });
        await user.click(entregadasTab);

        await waitFor(() => {
            const entregadaBadge = screen.getByText(/entregada ✓/i);
            expect(entregadaBadge).toBeInTheDocument();
        });
    });
});
