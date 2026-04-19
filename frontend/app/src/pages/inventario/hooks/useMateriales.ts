import { useState, useEffect, useMemo, useCallback } from 'react';
import { get, patch, post, del } from '../../../api';
import { Material } from '../types';
import { normalizarNombre, agruparMateriales, areaM2 } from '../utils/materialUtils';
import { notifyError, notifySuccess } from '../../../utils/notifications';

export const useMateriales = () => {
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [precioCostoPorNombre, setPrecioCostoPorNombre] = useState<Record<string, number>>({});
    const [planchasPorNombre, setPlanchasPorNombre] = useState<Record<string, number>>({});
    const [highlightNombre, setHighlightNombre] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    const allMateriales = useMemo(() => agruparMateriales(materiales), [materiales]);

    const filteredMateriales = useMemo(() => {
        return allMateriales.filter(m =>
            m.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allMateriales, searchTerm]);

    const fetchMateriales = useCallback(async () => {
        try {
            const rows = await get<Array<any>>('/api/materiales');
            const mats: Material[] = rows.map(r => {
                let fecha = r.ultima_actualizacion || '';
                if (fecha && !fecha.includes('T') && fecha.length <= 10) {
                    fecha = `${fecha}T12:00:00`;
                }
                return {
                    id: r.id,
                    nombre: r.nombre,
                    stockActual: r.stock_actual,
                    unidad: r.unidad,
                    stockMinimo: r.stock_minimo,
                    ultimaActualizacion: fecha,
                    espesorMm: r.espesor_mm,
                    anchoM: r.ancho_m,
                    largoM: r.largo_m,
                    precioM2: r.precio_m2,
                    precioMayorM2: r.precio_mayor_m2,
                    disponibleParaVenta: r.disponible_para_venta ?? true
                };
            });
            setMateriales(mats);

            const countByName: Record<string, number> = {};
            for (const mat of mats) {
                const key = normalizarNombre(mat.nombre);
                const count = Math.floor((mat.stockActual || 0) / areaM2(mat));
                countByName[key] = (countByName[key] || 0) + count;
            }
            setPlanchasPorNombre(countByName);

            return mats;
        } catch {
            return [];
        }
    }, []);

    const handleToggleDisponibilidad = useCallback(async (material: Material) => {
        try {
            const nuevoEstado = !(material.disponibleParaVenta ?? true);
            await patch(`/api/materiales/${material.id}?disponible_para_venta=${nuevoEstado}`);
            await fetchMateriales();
            notifySuccess(`Material ${nuevoEstado ? 'habilitado' : 'deshabilitado'} para venta`);
        } catch (e: any) {
            notifyError(e?.message || 'No se pudo actualizar disponibilidad');
        }
    }, [fetchMateriales]);

    const handleEliminarMaterial = useCallback(async (material: Material) => {
        try {
            const idsToDelete = material.ids || [material.id];
            for (const id of idsToDelete) {
                await del(`/api/materiales/${id}`);
            }
            await fetchMateriales();
            notifySuccess('Material archivado correctamente');
        } catch (e: any) {
            notifyError(e?.message || 'No se pudo archivar el material');
        }
    }, [fetchMateriales]);

    // Cargar datos iniciales
    useEffect(() => {
        (async () => {
            const mats = await fetchMateriales();

            // Cargar costos de compras
            try {
                const compras = await get<Array<any>>('/api/compras');
                const toDateMs = (value: string) => {
                    if (!value) return 0;
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) return d.getTime();
                    const partsSlash = value.split('/');
                    if (partsSlash.length === 3 && partsSlash[2].length === 4) {
                        const [dd, mm, yyyy] = partsSlash.map(p => parseInt(p, 10));
                        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
                            return new Date(yyyy, mm - 1, dd).getTime();
                        }
                    }
                    const partsDash = value.split('-');
                    if (partsDash.length === 3 && partsDash[0].length === 4) {
                        const [yyyy, mm, dd] = partsDash.map(p => parseInt(p, 10));
                        if (!isNaN(dd) && !isNaN(mm) && !isNaN(yyyy)) {
                            return new Date(yyyy, mm - 1, dd).getTime();
                        }
                    }
                    return 0;
                };
                const map: Record<string, { costo: number; menor?: number; mayor?: number; fechaMs: number; idx: number }> = {};
                let idx = 0;
                for (const c of compras) {
                    const key = normalizarNombre((c.material_nombre || c.material || c.material_id || '') as string);
                    if (!key) continue;
                    const costo = Math.max(0, Number((c.costo_m2 ?? c.precio_m2) || 0));
                    const menor = c.precio_m2 !== undefined && c.precio_m2 !== null ? Math.max(0, Number(c.precio_m2 || 0)) : undefined;
                    const mayor = c.precio_mayor_m2 !== undefined && c.precio_mayor_m2 !== null ? Math.max(0, Number(c.precio_mayor_m2 || 0)) : undefined;
                    const fechaMs = toDateMs((c.fecha || '') as string);
                    const prev = map[key];
                    if (!prev || fechaMs > prev.fechaMs || (fechaMs === prev.fechaMs && idx >= prev.idx)) {
                        map[key] = { costo, menor, mayor, fechaMs, idx };
                    }
                    idx += 1;
                }
                const byName: Record<string, number> = {};
                for (const [k, v] of Object.entries(map)) byName[k] = v.costo;
                setPrecioCostoPorNombre(byName);
                if (mats.length > 0) {
                    const updated = mats.map(m => {
                        const key = normalizarNombre(m.nombre);
                        const last = map[key];
                        if (!last) return m;
                        return {
                            ...m,
                            precioM2: last.menor !== undefined ? last.menor : m.precioM2,
                            precioMayorM2: last.mayor !== undefined ? last.mayor : m.precioMayorM2
                        };
                    });
                    setMateriales(updated);
                }
            } catch { }
        })();
    }, [fetchMateriales]);

    // Event listeners para actualizaciones
    useEffect(() => {
        const handler = (ev: any) => {
            try {
                const d = ev?.detail || {};
                const nombre = d.nombre || '';
                if (nombre) {
                    setHighlightNombre(nombre);
                    fetchMateriales();
                }
            } catch { }
        };

        const compraHandler = async (ev: any) => {
            try {
                const d = ev?.detail || {};
                const nombre = (d.material || '').toString();
                const key = normalizarNombre(nombre);
                const precio = Math.max(0, Number(d.costo_m2 ?? d.precio_m2 ?? 0));
                if (!key) return;

                setPrecioCostoPorNombre(prev => ({ ...prev, [key]: precio }));
                const menor = d.precio_m2;
                const mayor = d.precio_mayor_m2;
                if (menor !== undefined || mayor !== undefined) {
                    setMateriales(prev => prev.map(m => {
                        const mk = normalizarNombre(m.nombre);
                        if (mk !== key) return m;
                        return {
                            ...m,
                            precioM2: (menor !== undefined && menor !== null) ? Number(menor) : m.precioM2,
                            precioMayorM2: (mayor !== undefined && mayor !== null) ? Number(mayor) : m.precioMayorM2
                        };
                    }));
                }
                if (nombre) setHighlightNombre(nombre);
                await fetchMateriales();
            } catch { }
        };

        const costoHandler = (ev: any) => {
            try {
                const d = ev?.detail || {};
                const nombre = (d.material || '').toString();
                const key = normalizarNombre(nombre);
                const precio = Math.max(0, Number(d.costo_m2 ?? d.precio_m2 ?? 0));
                if (!key) return;
                setPrecioCostoPorNombre(prev => ({ ...prev, [key]: precio }));
                if (nombre) setHighlightNombre(nombre);
            } catch { }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('marmoles:material-upsert', handler as any);
            window.addEventListener('marmoles:material-select', handler as any);
            window.addEventListener('marmoles:compra-registrada', compraHandler as any);
            window.addEventListener('marmoles:costo-actualizado', costoHandler as any);
            const precioVentaHandler = (ev: any) => {
                try {
                    const d = ev?.detail || {};
                    const nombre = (d.material || '').toString();
                    const materialId = (d.material_id || '').toString();
                    const key = normalizarNombre(nombre);
                    if (!key && !materialId) return;
                    const menor = d.precio_m2;
                    const mayor = d.precio_mayor_m2;
                    const costo = d.costo_m2;
                    setMateriales(prev => prev.map(m => {
                        const mk = normalizarNombre(m.nombre);
                        const matchByName = key && mk === key;
                        const matchById = materialId && m.id === materialId;
                        if (!(matchByName || matchById)) return m;
                        return {
                            ...m,
                            precioM2: (menor !== undefined && menor !== null) ? Number(menor) : m.precioM2,
                            precioMayorM2: (mayor !== undefined && mayor !== null) ? Number(mayor) : m.precioMayorM2
                        };
                    }));
                    if (key && costo !== undefined && costo !== null) {
                        const costoNum = Math.max(0, Number(costo));
                        setPrecioCostoPorNombre(prev => ({ ...prev, [key]: costoNum }));
                    }
                    if (nombre) setHighlightNombre(nombre);
                } catch { }
            };
            window.addEventListener('marmoles:precio-venta-actualizado', precioVentaHandler as any);

            return () => {
                window.removeEventListener('marmoles:material-upsert', handler as any);
                window.removeEventListener('marmoles:material-select', handler as any);
                window.removeEventListener('marmoles:compra-registrada', compraHandler as any);
                window.removeEventListener('marmoles:costo-actualizado', costoHandler as any);
                window.removeEventListener('marmoles:precio-venta-actualizado', precioVentaHandler as any);
            };
        }
    }, [fetchMateriales]);

    return {
        materiales,
        allMateriales,
        filteredMateriales,
        precioCostoPorNombre,
        planchasPorNombre,
        highlightNombre,
        searchTerm,
        setSearchTerm,
        fetchMateriales,
        handleToggleDisponibilidad,
        handleEliminarMaterial,
    };
};
