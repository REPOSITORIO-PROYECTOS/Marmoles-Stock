import { Material } from '../types';

/**
 * Normaliza un nombre de material para comparaciones
 */
export const normalizarNombre = (s: string) => (s || '').trim().toLocaleLowerCase();

/**
 * Calcula el área en m² de un material
 */
export const areaM2 = (m: Material | null | undefined) => {
    const a = Number(m?.anchoM || 0);
    const l = Number(m?.largoM || 0);
    return a > 0 && l > 0 ? a * l : 1;
};

/**
 * Agrupa materiales con el mismo nombre
 */
export const agruparMateriales = (items: Material[]): Material[] => {
    const map = new Map<string, Material & { ids: string[] }>();
    for (const m of items) {
        const key = normalizarNombre(m.nombre);
        const prev = map.get(key);
        if (!prev) {
            map.set(key, { ...m, ids: [m.id] });
        } else {
            const ultima = prev.ultimaActualizacion || '';
            const curr = m.ultimaActualizacion || '';
            map.set(key, {
                ...prev,
                stockActual: (prev.stockActual || 0) + (m.stockActual || 0),
                stockMinimo: prev.stockMinimo,
                ultimaActualizacion: ultima > curr ? ultima : curr,
                ids: [...prev.ids, m.id],
                nombre: prev.nombre,
                unidad: prev.unidad || m.unidad,
                id: prev.id,
                precioM2: (m as any).precioM2 && (m as any).precioM2 > 0 ? (m as any).precioM2 : (prev as any).precioM2,
                precioMayorM2: (m as any).precioMayorM2 && (m as any).precioMayorM2 > 0 ? (m as any).precioMayorM2 : (prev as any).precioMayorM2,
            });
        }
    }
    return Array.from(map.values());
};

/**
 * Formatea una fecha para mostrar
 */
export const formatearFecha = (fecha: string | null | undefined): string => {
    if (!fecha || fecha === '-') return '-';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * LocalStorage key para últimos costos
 */
export const LS_COSTO_KEY = 'marmoles:ultimoCostoMaterial';

/**
 * Lee los últimos costos del localStorage
 */
export const leerUltimosCostos = (): Record<string, number> => {
    try {
        if (typeof window === 'undefined') return {};
        const j = window.localStorage.getItem(LS_COSTO_KEY);
        return j ? JSON.parse(j) || {} : {};
    } catch {
        return {};
    }
};
