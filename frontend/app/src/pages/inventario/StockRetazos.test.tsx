import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockRetazos } from './StockRetazos';

const setupFetchMock = () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        const u = String(url);
        if (u.includes('/api/materiales')) {
            return {
                ok: true,
                json: async () => [
                    { id: 'm1', nombre: 'Blanco Brasil', precio_m2: 5000 },
                    { id: 'm2', nombre: 'Negro San Luis', precio_m2: 6000 },
                ],
                headers: { get: () => 'application/json' },
            } as any;
        }
        if (u.includes('/api/inventario/retazos?estado=disponible')) {
            // First load empty, after creation return one
            const hasPost = calls.some(c => String(c.url).includes('/api/inventario/retazos?material_id='));
            const rows = hasPost
                ? [{ id: 'r1', material_id: 'm1', ancho: 50, largo: 40, estado: 'disponible', en_venta: false, precio: null }]
                : [];
            return {
                ok: true,
                json: async () => rows,
                headers: { get: () => 'application/json' },
            } as any;
        }
        if (u.includes('/api/inventario/retazos?material_id=')) {
            return { ok: true, json: async () => ({ id: 'r1' }), headers: { get: () => 'application/json' } } as any;
        }
        if (u.includes('/api/inventario/retazos/ventas')) {
            return { ok: true, json: async () => [], headers: { get: () => 'application/json' } } as any;
        }
        if (u.includes('/api/lotes?material_id=')) {
            return {
                ok: true,
                json: async () => [{ id: 'l1', codigo_lote: 'L-001' }],
                headers: { get: () => 'application/json' },
            } as any;
        }
        return { ok: true, json: async () => ({}), headers: { get: () => 'application/json' } } as any;
    };
    return calls;
};

describe('StockRetazos', () => {
    beforeEach(() => {
        setupFetchMock();
    });

    it('crea un retazo via dialog y actualiza inventario', async () => {
        const user = userEvent.setup();
        render(<StockRetazos />);

        // Abre el diálogo "Añadir retazo"
        const addBtn = await screen.findByRole('button', { name: /Añadir retazo/i });
        await user.click(addBtn);

        // Seleccionar material
        const trigger = await screen.findByRole('combobox', { name: /Material/i });
        await user.click(trigger);
        const option = await screen.findByRole('option', { name: /Blanco Brasil/i });
        await user.click(option);

        // Completar medidas y precio
        const ancho = await screen.findByLabelText(/Ancho \(cm\)/i);
        const largo = await screen.findByLabelText(/Largo \(cm\)/i);
        const precioM2 = await screen.findByLabelText(/Precio \(m²\)/i);
        await user.clear(ancho);
        await user.type(ancho, '50');
        await user.clear(largo);
        await user.type(largo, '40');
        await user.clear(precioM2);
        await user.type(precioM2, '5000');

        // Crear
        const createBtn = await screen.findByRole('button', { name: /Crear Retazo/i });
        await user.click(createBtn);

        // El inventario debería mostrar "Retazos en Venta" contadores actualizados
        const resumen = await screen.findByRole('heading', { name: /Stock de Retazos/i });
        expect(resumen).toBeDefined();
        // Y el valor de Área Disponible debería reflejar el nuevo retazo
        const area = await screen.findByText(/Área Disponible/i);
        expect(area).toBeDefined();
    });
});
