from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal

# Auth
class LoginPayload(BaseModel):
    usuario: str
    password: str

class UsuarioCreate(BaseModel):
    username: str
    email: str
    password: str
    rol: Optional[str] = "deposito"
    nombre_completo: Optional[str] = None


class CambioPasswordPayload(BaseModel):
    password_actual: str
    password_nueva: str

# CRM
class LeadCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    dni: Optional[str] = None
    direccion: Optional[str] = None
    coordenadas: Optional[str] = None
    estado: Optional[str] = "nuevo"
    origen: Optional[str] = None

class LeadUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    dni: Optional[str] = None
    direccion: Optional[str] = None
    coordenadas: Optional[str] = None
    estado: Optional[str] = None
    origen: Optional[str] = None

class LeadBulkDeletePayload(BaseModel):
    ids: List[str]

class ClienteCreate(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    coordenadas: Optional[str] = None

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    coordenadas: Optional[str] = None

# Inventario
class MaterialCreate(BaseModel):
    nombre: str
    precio_m2: float = 0.0
    precio_mayor_m2: Optional[float] = None
    espesor_mm: Optional[int] = None
    color: Optional[str] = None
    ancho_m: Optional[float] = None
    largo_m: Optional[float] = None
    stock_actual: Optional[float] = 0.0
    unidad: Optional[str] = "m²"
    stock_minimo: Optional[float] = 0.0

class CompraProveedor(BaseModel):
    material: str
    proveedor: str
    cantidad: float
    monto: float
    fecha: Optional[str] = None
    precio_m2: Optional[float] = None
    precio_mayor_m2: Optional[float] = None
    costo_m2: Optional[float] = None
    lote: Optional[str] = None
    largo_m: Optional[float] = None
    ancho_m: Optional[float] = None
    ubicacion: Optional[str] = None

class RetazoUpdate(BaseModel):
    ancho: Optional[int] = None
    largo: Optional[int] = None
    espesor: Optional[int] = None
    lote_id: Optional[str] = None
    ubicacion: Optional[str] = None
    estado: Optional[str] = None
    en_venta: Optional[bool] = None
    precio: Optional[float] = None
    geometria_json: Optional[str] = None

class RetazoCreate(BaseModel):
    material_id: str
    ancho: int
    largo: int
    espesor: Optional[int] = None
    lote_id: Optional[str] = None
    ubicacion: Optional[str] = None
    precio: Optional[float] = None
    geometria_json: Optional[str] = None


class PlacaCreate(BaseModel):
    material_id: str
    ancho: int
    largo: int
    espesor: Optional[int] = None
    codigo: Optional[str] = None
    lote_id: Optional[str] = None
    ubicacion: Optional[str] = None
    precio: Optional[float] = None

class VentaRetazo(BaseModel):
    cliente: Optional[str] = None
    telefono: Optional[str] = None
    forma_pago: Optional[str] = None
    precio: Optional[float] = None

class ProveedorCreate(BaseModel):
    nombre: str
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None

class LoteCreate(BaseModel):
    material_id: str
    codigo_lote: str
    proveedor_id: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    imagen_url: Optional[str] = None
    cantidad_inicial: Optional[float] = 0.0
    stock_actual: Optional[float] = 0.0
    cantidad: Optional[int] = 1
    ubicacion: Optional[str] = None
    notas: Optional[str] = None

class LoteUpdate(BaseModel):
    material_id: Optional[str] = None
    codigo_lote: Optional[str] = None
    proveedor_id: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    imagen_url: Optional[str] = None
    cantidad_inicial: Optional[float] = None
    stock_actual: Optional[float] = None
    cantidad: Optional[int] = None
    ubicacion: Optional[str] = None
    notas: Optional[str] = None
    costo_m2: Optional[float] = None
    precio_venta: Optional[float] = None
    precio_mayorista: Optional[float] = None

# Presupuestos
class PresupuestoLineaCreate(BaseModel):
    # Tipo de ítem: material, articulo, accesorio, extra
    tipo: Literal["material", "articulo", "accesorio", "extra"] = "material"
    # IDs de los diferentes tipos
    material_id: Optional[str] = None
    producto_id: Optional[str] = None
    accesorio_id: Optional[str] = None
    # Información del material (legacy)
    material: Optional[str] = ""
    descripcion: Optional[str] = ""
    # Medidas y cantidad
    metros_cuadrados: float = 0.0
    medidas: Optional[str] = ""
    unidad: Optional[str] = "m²"
    cantidad: Optional[float] = None
    # Precios
    precio_unitario: float
    # Condiciones
    condiciones: Optional[str] = ""
    cortes_especiales: Optional[bool] = False
    agujeros: Optional[int] = 0
    recargo_extra: Optional[float] = 0
    # Lote y planos
    lote_id: Optional[str] = None
    placa_completa: Optional[bool] = False
    geometria_json: Optional[str] = None
    planos_manual_json: Optional[str] = None

class PresupuestoCreate(BaseModel):
    cliente_id: str
    observaciones: Optional[str] = ""
    coordenadas: Optional[str] = None
    archivos_adjuntos: Optional[List[str]] = []
    anexosImagenes: Optional[List[str]] = []
    lineas: List[PresupuestoLineaCreate]
    items_adicionales: Optional[List[Dict[str, Any]]] = []
    tipo_cobro: Optional[str] = "contado"
    con_factura: Optional[bool] = False
    iva_tasa: Optional[float] = 0.21
    descuento_tipo: Optional[str] = None  # 'fijo' | 'porcentaje'
    descuento_valor: Optional[float] = 0

class PresupuestoUpdate(BaseModel):
    cliente_id: Optional[str] = None
    observaciones: Optional[str] = None
    coordenadas: Optional[str] = None
    archivos_adjuntos: Optional[List[str]] = None
    anexosImagenes: Optional[List[str]] = None
    lineas: Optional[List[PresupuestoLineaCreate]] = None
    items_adicionales: Optional[List[Dict[str, Any]]] = None
    tipo_cobro: Optional[str] = None
    con_factura: Optional[bool] = None
    iva_tasa: Optional[float] = None
    descuento_tipo: Optional[str] = None
    descuento_valor: Optional[float] = None

class ArticuloCreate(BaseModel):
    nombre: str
    precio_unitario: float
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = True

class ArticuloUpdate(BaseModel):
    nombre: Optional[str] = None
    precio_unitario: Optional[float] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None

class PlanoClienteMaterialCreate(BaseModel):
    cliente_id: str
    material: str
    aprobado: bool
    firmado_por: Optional[str] = None
    imagen: Optional[str] = None
    medidas: Optional[str] = None

class PresupuestoMetaPayload(BaseModel):
    data: Dict[str, Any]

# Finanzas
class SuscripcionCreate(BaseModel):
    frecuencia: str
    dia_cobro: int
    proximo_cobro: str

class PagoCreate(BaseModel):
    presupuesto_id: str
    cliente_id: Optional[str] = None
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None
    nota: Optional[str] = None
    recurrente: Optional[SuscripcionCreate] = None

class PagoResponse(BaseModel):
    id: str
    presupuesto_id: str
    cliente_id: Optional[str] = None
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None
    nota: Optional[str] = None
    fecha: Any

    class Config:
        orm_mode = True

class PagoUpdate(BaseModel):
    monto: Optional[float] = None
    metodo_pago: Optional[str] = None
    referencia: Optional[str] = None
    estado: Optional[str] = None
    nota: Optional[str] = None


class ModeloPredefinidoBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    contenido_json: Optional[str] = None
    precio_base: Optional[float] = 0.0
    imagen_url: Optional[str] = None

class ModeloPredefinidoCreate(ModeloPredefinidoBase):
    pass

class ModeloPredefinidoUpdate(ModeloPredefinidoBase):
    nombre: Optional[str] = None


class ClienteCreditoUpdate(BaseModel):
    es_cuenta_corriente: bool
    limite_credito: float

# Planos (Existing)
class PlanoTecnicoCreate(BaseModel):
    nombre: str
    cliente_id: Optional[str] = None
    proyecto: Optional[str] = None
    categoria: Optional[str] = "General"
    estado: Optional[str] = "borrador"
    tipo: Optional[str] = "manual"
    contenido_json: Optional[str] = None

class PlanoTecnicoUpdate(BaseModel):
    nombre: Optional[str] = None
    cliente_id: Optional[str] = None
    proyecto: Optional[str] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None
    ultimo_archivo: Optional[str] = None
    tipo: Optional[str] = None
    contenido_json: Optional[str] = None

class PlanoRevisionCreate(BaseModel):
    version: int
    archivo_url: str
    comentarios: Optional[str] = None
    subido_por: Optional[str] = None

class PlacaUpdate(BaseModel):
    material_id: Optional[str] = None
    ancho: Optional[int] = None
    largo: Optional[int] = None
    estado: Optional[str] = None
    precio: Optional[float] = None
    lote_id: Optional[str] = None
    codigo: Optional[str] = None
    plano_tecnico_id: Optional[str] = None
    reservado_por: Optional[str] = None
    reservado_hasta: Optional[str] = None

# Servicios (New)
class ServicioCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = "General"
    precio_base: float
    unidad: Optional[str] = "global"
    proveedor_id: Optional[str] = None
    tiempo_estimado: Optional[str] = None
    disponible: Optional[bool] = True
    detalles_tecnicos: Optional[dict] = None
    observaciones: Optional[str] = None

# Logística y Calidad
class EntregaStatusUpdate(BaseModel):
    estado_logistica: str # programada, en_ruta, entregada
    fecha_entrega_programada: Optional[str] = None

class RevisionConfirmPayload(BaseModel):
    material_id: Optional[str] = None
    lote_id: Optional[str] = None
    geometria_json: Optional[str] = None
    medidas: Optional[str] = None
    espesor: Optional[int] = None
    color: Optional[str] = None
    notas_tecnicas: Optional[str] = None

class FeedbackCalidadSubmit(BaseModel):
    calificacion: int # 1-5
    comentarios: Optional[str] = None
    fotos_url: Optional[str] = None

class EntregaDireccionUpdate(BaseModel):
    direccion: str

class EntregaPiezasPayload(BaseModel):
    pieza_ids: List[str]

class ServicioUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    precio_base: Optional[float] = None
    unidad: Optional[str] = None
    proveedor_id: Optional[str] = None
    tiempo_estimado: Optional[str] = None
    disponible: Optional[bool] = None
    detalles_tecnicos: Optional[dict] = None
    observaciones: Optional[str] = None

class PrestacionServicioCreate(BaseModel):
    servicio_id: str
    presupuesto_id: Optional[str] = None
    cliente_id: Optional[str] = None
    fecha_prestacion: Optional[str] = None
    costo: float
    notas: Optional[str] = None
    estado: Optional[str] = "pendiente"

class PrestacionServicioUpdate(BaseModel):
    estado: Optional[str] = None
    aprobado_por: Optional[str] = None
    firma_digital: Optional[str] = None
    fecha_prestacion: Optional[str] = None
