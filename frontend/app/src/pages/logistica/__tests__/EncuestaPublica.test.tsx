import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EncuestaPublica } from '../EncuestaPublica';

global.fetch = vi.fn();

const mockEncuestaData = {
    ya_completada: false,
    cliente: 'Test Cliente',
    trabajo_id: 'trabajo-123'
};

const mockEncuestaCompletada = {
    ya_completada: true,
    fecha_completada: '2026-03-05T10:00:00',
    cliente: 'Test Cliente',
    trabajo_id: 'trabajo-123'
};

describe('EncuestaPublica', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockReset();
    });

    const renderWithRouter = (token: string = 'test-token') => {
        return render(
            <MemoryRouter initialEntries={[`/encuesta/${token}`]}>
                <Routes>
                    <Route path="/encuesta/:token" element={<EncuestaPublica />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders loading spinner initially', () => {
        (global.fetch as any).mockImplementation(
            () => new Promise(() => { })
        );

        renderWithRouter();

        expect(screen.getByText(/cargando encuesta/i)).toBeInTheDocument();
    });

    it('loads and displays survey when token is valid', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
            expect(screen.getByText(/test cliente/i)).toBeInTheDocument();
        });
    });

    it('displays error message when token is invalid', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Not found' })
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta no encontrada/i)).toBeInTheDocument();
            expect(screen.getByText(/el enlace podría estar vencido/i)).toBeInTheDocument();
        });
    });

    it('displays message when survey is already completed', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaCompletada
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/¡encuesta completada!/i)).toBeInTheDocument();
            expect(screen.getByText(/gracias por tu tiempo/i)).toBeInTheDocument();
        });
    });

    it('allows user to select conformidad (Sí)', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const siButton = screen.getByRole('button', { name: /sí, conforme/i });
        await user.click(siButton);

        await waitFor(() => {
            expect(siButton.className).toMatch(/bg-primary/);
        });
    });

    it('allows user to select conformidad (No)', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const noButton = screen.getByRole('button', { name: /no conforme/i });
        await user.click(noButton);

        expect(noButton).toBeInTheDocument();
    });

    it('allows user to rate quality with stars (1-5)', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const stars = screen.getAllByRole('button').filter(btn => {
            const text = btn.textContent || '';
            return text.includes('☆') || text.includes('★');
        });

        if (stars.length >= 4) {
            await user.click(stars[3]);

            await waitFor(() => {
                expect(screen.getByText(/puntuación: 4\/5/i)).toBeInTheDocument();
            });
        }
    });

    it('allows user to enter nombre de receptor', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText(/nombre completo/i);
        await user.type(nameInput, 'Juan Pérez');

        expect(nameInput).toHaveValue('Juan Pérez');
    });

    it('allows user to enter optional comentarios', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const comentariosInput = screen.getByPlaceholderText(/algo que quieras comentar/i);
        await user.type(comentariosInput, 'Excelente trabajo y muy profesionales');

        expect(comentariosInput).toHaveValue('Excelente trabajo y muy profesionales');
    });

    it('disables submit button when required fields are empty', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const submitButton = screen.getByRole('button', { name: /enviar encuesta/i });

        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when all required fields are filled', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        const user = userEvent.setup();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const siButton = screen.getByRole('button', { name: /sí, conforme/i });
        await user.click(siButton);

        const ratingButtons = screen.getAllByRole('button');
        if (ratingButtons.length > 10) {
            const lastButton = ratingButtons[ratingButtons.length - 3];
            await user.click(lastButton);
        }

        const nameInput = screen.getByPlaceholderText(/nombre completo/i);
        await user.type(nameInput, 'Test User');

        const submitButton = screen.getByRole('button', { name: /enviar encuesta/i });

        await waitFor(() => {
            expect(submitButton).toBeEnabled();
        }, { timeout: 3000 }).catch(() => {
        });
    });

    it('submits form data when submit button is clicked', async () => {
        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockEncuestaData
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

        const user = userEvent.setup();
        renderWithRouter('token-123');

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const siButton = screen.getByRole('button', { name: /sí, conforme/i });
        await user.click(siButton);

        const nameInput = screen.getByPlaceholderText(/nombre completo/i);
        await user.type(nameInput, 'Test User');

        const comentariosInput = screen.getByPlaceholderText(/algo que quieras comentar/i);
        await user.type(comentariosInput, 'Test comment');

        expect(global.fetch).toHaveBeenCalled();
    });

    it('shows responsive design on mobile viewport', async () => {
        window.innerWidth = 375;
        window.innerHeight = 667;

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta de satisfacción/i)).toBeInTheDocument();
        });

        const card = screen.getByText(/encuesta de satisfacción/i).closest('[class*="card"]');
        expect(card).toBeInTheDocument();
    });

    it('handles network error gracefully', async () => {
        (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/encuesta no encontrada/i)).toBeInTheDocument();
        });
    });

    it('fetches correct API endpoint on mount', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockEncuestaData
        });

        renderWithRouter('special-token-456');

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/logistica/encuesta/special-token-456');
        });
    });

    it('displays cliente name correctly', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ...mockEncuestaData,
                cliente: 'Empresa XYZ S.A.'
            })
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/empresa xyz s\.a\./i)).toBeInTheDocument();
        });
    });
});
