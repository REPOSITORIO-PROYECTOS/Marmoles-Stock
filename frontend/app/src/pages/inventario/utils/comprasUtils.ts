/**
 * Normaliza un nombre para comparaciones
 */
export const normalizarNombre = (s: string) => (s || '').trim().toLocaleLowerCase();

/**
 * Valida formato de email
 */
export const emailValido = (s: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/**
 * Valida formato de teléfono
 */
export const telefonoValido = (s: string) => !s || /^[\d+\s()\-]{6,}$/.test(s);

/**
 * Calcula el área en m²
 */
export const calcularAreaM2 = (ancho_m: number, alto_m: number): number => {
    return ancho_m * alto_m;
};

/**
 * Calcula el costo por m² desde el monto total
 */
export const calcularCostoM2 = (monto_total: number, area_m2: number): number => {
    if (area_m2 <= 0) return 0;
    return monto_total / area_m2;
};

/**
 * Calcula el precio de venta desde costo y porcentaje
 */
export const calcularPrecioVentaPorPorcentaje = (costo_m2: number, porcentaje: number): number => {
    return costo_m2 * (1 + porcentaje / 100);
};

/**
 * Calcula el porcentaje de ganancia desde precio y costo
 */
export const calcularPorcentajeGanancia = (precio_venta: number, costo_m2: number): number => {
    if (costo_m2 <= 0) return 0;
    const ganancia = ((precio_venta - costo_m2) / costo_m2) * 100;
    return isFinite(ganancia) ? ganancia : 0;
};

/**
 * Obtiene opciones únicas de nombres
 */
export const obtenerOpcionesUnicas = <T extends { nombre: string }>(items: T[]): string[] => {
    return Array.from(new Map(items.map(item => [normalizarNombre(item.nombre), item.nombre])).values());
};

/**
 * Formatea fecha a string local
 */
export const formatearFecha = (fecha: string): string => {
    if (!fecha) return '-';
    try {
        return new Date(fecha).toLocaleDateString('es-AR');
    } catch {
        return '-';
    }
};
