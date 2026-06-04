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
    material_nombre?: string;
    lote_id?: string | null;
    lote_codigo?: string | null;
    codigo?: string | null;
    largo: number;
    ancho: number;
    espesor?: number | null;
    m2?: number;
    ubicacion?: string | null;
    estado: string;
    precio?: number | null;
    reservado_por?: string | null;
    plano_tecnico_id?: string | null;
}
