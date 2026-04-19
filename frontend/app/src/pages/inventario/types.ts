export interface Material {
    id: string;
    nombre: string;
    stockActual: number;
    unidad: string;
    stockMinimo: number;
    ultimaActualizacion: string;
    espesorMm?: number;
    largoM?: number;
    anchoM?: number;
    precioM2?: number;
    precioMayorM2?: number;
    disponibleParaVenta?: boolean;
    ids?: string[]; // Para materiales agrupados
}

export interface Lote {
    id: string;
    material_id: string;
    codigo_lote: string;
    proveedor_nombre?: string;
    fecha_ingreso: string;
    stock_actual: number;
    cantidad: number;
    costo_m2?: number;
    precio_venta?: number;
    precio_mayorista?: number;
    largo_m?: number;
    ancho_m?: number;
    ubicacion?: string;
    notas?: string;
}

export interface Placa {
    id: string;
    material_id: string;
    largo: number;
    ancho: number;
    estado: string;
}
