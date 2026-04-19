export interface Proveedor {
    id: string;
    nombre: string;
    contacto: string;
    telefono: string;
    email: string;
    especialidad: string;
}

export interface Material {
    id: string;
    nombre: string;
    precio_m2: number;
    espesor_mm?: number;
    ancho_m?: number;
    largo_m?: number;
}

export interface ProductoEstatico {
    id: string;
    nombre: string;
    descripcion: string;
    precio_venta: number;
    categoria: string;
}

export interface LoteBasic {
    id: string;
    codigo_lote: string;
    stock_actual: number;
    ubicacion?: string;
    fecha_ingreso?: string;
    ancho_m?: number;
    largo_m?: number;
    costo_m2?: number;
}

export interface Compra {
    id: string;
    proveedor: string;
    material: string;
    monto: number;
    fecha: string;
    cantidad?: number;
    costo_m2?: number;
    precio_m2?: number;
    precio_mayor_m2?: number;
    lote?: string;
    largo_m?: number;
    ancho_m?: number;
}

export type TipoCompra = 'material' | 'producto';

export type PrecioVentaTipo = 'fijo' | 'porcentaje';

export type CostoMode = 'costo_m2' | 'monto_total';

export interface NuevaCompraForm {
    proveedor: string;
    material: string;
    producto: string;
    ancho_m: number;
    alto_m: number;
    lote: string;
    costo_m2: number;
    monto_total: number;
    costoMode: CostoMode;
    precio_venta_tipo: PrecioVentaTipo;
    precio_venta_valor: number;
    precio_venta_menor?: number;
    precio_venta_mayor?: number;
    porcentaje_ganancia: number;
    metodo_pago: string;
    cantidad_producto: number;
    cantidad_placas: number;
    ubicacion?: string;
}

export interface NuevoProveedorForm {
    nombre: string;
    contacto: string;
    telefono: string;
    email: string;
    especialidad: string;
}

export interface NuevoMaterialForm {
    nombre: string;
    espesor_mm: number;
    ancho_m: number;
    alto_m: number;
    precio_m2?: number;
}

export interface NuevoProductoForm {
    nombre: string;
    descripcion: string;
    precio_venta: number;
    categoria: string;
}
