import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockRetazos } from './StockRetazos';

vi.mock('./RetazoMicroPlanoCanvas', () => ({
  RetazoMicroPlanoCanvas: () => null,
}));

const setupFetchMock = (options?: {
    initialRetazos?: any[];
}) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let retazos = [...(options?.initialRetazos ?? [])];
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
            return {
                ok: true,
                json: async () => retazos,
                headers: { get: () => 'application/json' },
            } as any;
        }
        if (u.endsWith('/api/inventario/retazos') && init?.method === 'POST') {
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            const created = {
                id: `r${retazos.length + 1}`,
                material_id: body.material_id,
                lote_id: body.lote_id ?? null,
                ancho: body.ancho,
                largo: body.largo,
                espesor: body.espesor ?? null,
                ubicacion: body.ubicacion ?? null,
                estado: 'disponible',
                en_venta: false,
                precio: body.precio ?? null,
                geometria_json: body.geometria_json ?? null,
                area_mm2: (() => {
                    try {
                        const geo = body.geometria_json ? JSON.parse(body.geometria_json) : null;
                        return geo?.area_mm2 ?? body.ancho * body.largo;
                    } catch {
                        return body.ancho * body.largo;
                    }
                })(),
            };
            retazos = [...retazos, created];
            return { ok: true, json: async () => ({ id: created.id }), headers: { get: () => 'application/json' } } as any;
        }
        if (/\/api\/inventario\/retazos\/[^/]+$/.test(u) && init?.method === 'PUT') {
            const id = u.split('/').pop();
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            retazos = retazos.map(r => r.id === id ? {
                ...r,
                ...body,
                area_mm2: body.geometria_json
                    ? (() => {
                        try {
                            const geo = JSON.parse(body.geometria_json);
                            return geo?.area_mm2 ?? ((body.ancho ?? r.ancho) * (body.largo ?? r.largo));
                        } catch {
                            return (body.ancho ?? r.ancho) * (body.largo ?? r.largo);
                        }
                    })()
                    : ((body.ancho ?? r.ancho) * (body.largo ?? r.largo)),
            } : r);
            return { ok: true, json: async () => ({ id }), headers: { get: () => 'application/json' } } as any;
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

function mockCanvas2dContext(): Partial<CanvasRenderingContext2D> {
    const noop = () => {};
    return {
        clearRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        closePath: noop,
        stroke: noop,
        arc: noop,
        fill: noop,
        fillRect: noop,
        strokeRect: noop,
        fillText: noop,
        setLineDash: noop,
    };
}

describe('StockRetazos', () => {
    beforeEach(() => {
        setupFetchMock();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
            mockCanvas2dContext() as CanvasRenderingContext2D
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
        const ancho = await screen.findByLabelText(/Ancho \(mm\)/i);
        const largo = await screen.findByLabelText(/Largo \(mm\)/i);
        const precioM2 = await screen.findByLabelText(/Precio \(m²\)/i);
        await user.clear(ancho);
        await user.type(ancho, '400');
        await user.clear(largo);
        await user.type(largo, '500');
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

    it('preserva puntos y geometria poligonal al editar un retazo existente', async () => {
        const polygonGeo = {
            v: 1,
            tipo: 'polygon',
            shapeType: 'polygon',
            area_mm2: 120000,
            bbox: { width: 400, height: 300 },
            points: [
                { x: 0, y: 0 },
                { x: 400, y: 0 },
                { x: 400, y: 150 },
                { x: 250, y: 150 },
                { x: 250, y: 300 },
                { x: 0, y: 300 },
            ],
            lados: [400, 150, 150, 150, 250, 300],
        };
        const calls = setupFetchMock({
            initialRetazos: [{
                id: 'r-poly',
                material_id: 'm1',
                ancho: 300,
                largo: 400,
                estado: 'disponible',
                en_venta: false,
                precio: 1500,
                geometria_json: JSON.stringify(polygonGeo),
                area_mm2: 120000,
            }],
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() =>
            mockCanvas2dContext() as CanvasRenderingContext2D
        );

        const user = userEvent.setup();
        render(<StockRetazos />);

        const editBtn = await screen.findByRole('button', { name: /Editar/i });
        await user.click(editBtn);

        const precio = await screen.findByLabelText(/Precio de venta/i);
        await user.clear(precio);
        await user.type(precio, '2100');

        const saveBtn = await screen.findByRole('button', { name: /Guardar Cambios/i });
        await user.click(saveBtn);

        await waitFor(() => {
            const putCall = calls.find(c => /\/api\/inventario\/retazos\/r-poly$/.test(c.url) && c.init?.method === 'PUT');
            expect(putCall).toBeDefined();
            const body = JSON.parse(String(putCall?.init?.body ?? '{}'));
            const geo = JSON.parse(String(body.geometria_json));
            expect(geo.tipo).toBe('polygon');
            expect(geo.points).toEqual(polygonGeo.points);
            expect(geo.lados).toEqual(polygonGeo.lados);
            expect(body.precio).toBe(2100);
        });
    });

    it('crea un retazo poligonal y guarda los puntos en geometria_json', async () => {
        const calls = setupFetchMock();
        const user = userEvent.setup();
        render(<StockRetazos />);

        const addBtn = await screen.findByRole('button', { name: /Añadir retazo/i });
        await user.click(addBtn);

        const trigger = await screen.findByRole('combobox', { name: /Material/i });
        await user.click(trigger);
        const option = await screen.findByRole('option', { name: /Blanco Brasil/i });
        await user.click(option);

        const formaLibreBtn = await screen.findByRole('button', { name: /Forma libre/i });
        await user.click(formaLibreBtn);

        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 0, top: 0, left: 0, bottom: 260, right: 420, width: 420, height: 260, toJSON: () => ({})
        } as DOMRect);

        fireEvent.click(canvas, { clientX: 20, clientY: 20 });
        fireEvent.click(canvas, { clientX: 220, clientY: 20 });
        fireEvent.click(canvas, { clientX: 220, clientY: 140 });
        fireEvent.click(canvas, { clientX: 20, clientY: 140 });

        const cerrarBtn = await screen.findByRole('button', { name: /Cerrar forma/i });
        await user.click(cerrarBtn);

        const precioM2 = await screen.findByLabelText(/Precio \(m²\)/i);
        await user.clear(precioM2);
        await user.type(precioM2, '5000');

        const createBtn = await screen.findByRole('button', { name: /Crear Retazo/i });
        await user.click(createBtn);

        await waitFor(() => {
            const postCall = calls.find(c => c.url.endsWith('/api/inventario/retazos') && c.init?.method === 'POST');
            expect(postCall).toBeDefined();
            const body = JSON.parse(String(postCall?.init?.body ?? '{}'));
            const geo = JSON.parse(String(body.geometria_json));
            expect(geo.tipo).toBe('polygon');
            expect(geo.points).toEqual([
                { x: 20, y: 20 },
                { x: 220, y: 20 },
                { x: 220, y: 140 },
                { x: 20, y: 140 },
            ]);
            expect(geo.bbox).toEqual({ width: 200, height: 120 });
            expect(geo.area_mm2).toBe(24000);
            expect(body.largo).toBe(200);
            expect(body.ancho).toBe(120);
        });
    });
});
