import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import String, DateTime, Boolean, Float, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase

class Base(DeclarativeBase):
    pass

# --- SECURITY ---
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    password_salt: Mapped[str] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(32), default="ventas")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

class Session(Base):
    __tablename__ = "sessions"
    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False))

# --- CRM ---
class Cliente(Base):
    __tablename__ = "clientes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str] = mapped_column(String(64), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    dni: Mapped[str] = mapped_column(String(32), nullable=True)
    direccion: Mapped[str] = mapped_column(String(255), nullable=True)
    coordenadas: Mapped[str] = mapped_column(String(255), nullable=True)
    es_cuenta_corriente: Mapped[bool] = mapped_column(default=False)
    limite_credito: Mapped[float] = mapped_column(default=0.0)
    saldo_actual: Mapped[float] = mapped_column(default=0.0)

class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str] = mapped_column(String(64), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    dni: Mapped[str] = mapped_column(String(32), nullable=True)
    direccion: Mapped[str] = mapped_column(String(255), nullable=True)
    coordenadas: Mapped[str] = mapped_column(String(255), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="nuevo")
    fecha_creacion: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cliente_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

class Oportunidad(Base):
    __tablename__ = "oportunidades"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    estado: Mapped[str] = mapped_column(String(32), default="abierta")
    monto_estimado: Mapped[float] = mapped_column(Float)

class Actividad(Base):
    __tablename__ = "actividades"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    oportunidad_id: Mapped[str] = mapped_column(String(36), index=True)
    tipo: Mapped[str] = mapped_column(String(64))
    nota: Mapped[str] = mapped_column(String(1024))

# --- INVENTARIO ---
class Material(Base):
    __tablename__ = "materiales"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    precio_m2: Mapped[float] = mapped_column(Float)
    # Precio mayorista por m² (opcional)
    precio_mayor_m2: Mapped[float] = mapped_column(Float, nullable=True)
    espesor_mm: Mapped[int] = mapped_column(Integer, nullable=True)
    color: Mapped[str] = mapped_column(String(64), nullable=True)
    ancho_mm: Mapped[float] = mapped_column(Float, nullable=True)  # Dimensión en milímetros (mm)
    largo_mm: Mapped[float] = mapped_column(Float, nullable=True)   # Dimensión en milímetros (mm)
    stock_actual: Mapped[float] = mapped_column(Float, default=0.0)
    unidad: Mapped[str] = mapped_column(String(16), default="m²")   # Unidad de stock (m² o piezas)
    stock_minimo: Mapped[float] = mapped_column(Float, default=0.0)
    ultima_actualizacion: Mapped[str] = mapped_column(String(64), nullable=True)
    disponible_para_venta: Mapped[bool] = mapped_column(Boolean, default=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

class Proveedor(Base):
    __tablename__ = "proveedores"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    contacto: Mapped[str] = mapped_column(String(255), nullable=True)
    telefono: Mapped[str] = mapped_column(String(64), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    direccion: Mapped[str] = mapped_column(String(255), nullable=True)

class Compra(Base):
    __tablename__ = "compras"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    proveedor: Mapped[str] = mapped_column(String(255))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    cantidad: Mapped[float] = mapped_column(Float)
    monto: Mapped[float] = mapped_column(Float)
    fecha: Mapped[str] = mapped_column(String(64), nullable=True)
    precio_m2: Mapped[float] = mapped_column(Float, nullable=True)
    precio_mayor_m2: Mapped[float] = mapped_column(Float, nullable=True)
    costo_m2: Mapped[float] = mapped_column(Float, nullable=True)

class Placa(Base):
    __tablename__ = "placas"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    largo: Mapped[int] = mapped_column(Integer)
    ancho: Mapped[int] = mapped_column(Integer)
    espesor: Mapped[int] = mapped_column(Integer, nullable=True)
    codigo: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    plano_tecnico_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    ubicacion: Mapped[str] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="disponible")
    precio: Mapped[float] = mapped_column(Float, nullable=True)
    reservado_por: Mapped[str] = mapped_column(String(36), nullable=True)
    reservado_hasta: Mapped[str] = mapped_column(String(64), nullable=True)

class Lote(Base):
    __tablename__ = "lotes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    codigo_lote: Mapped[str] = mapped_column(String(64))
    proveedor_id: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha_ingreso: Mapped[str] = mapped_column(String(64), nullable=True)
    imagen_url: Mapped[str] = mapped_column(String(512), nullable=True)
    cantidad_inicial: Mapped[float] = mapped_column(Float, default=0.0)
    stock_actual: Mapped[float] = mapped_column(Float, default=0.0)
    cantidad: Mapped[int] = mapped_column(Integer, default=1)
    costo_m2: Mapped[float] = mapped_column(Float, default=0.0)
    precio_venta: Mapped[float] = mapped_column(Float, default=0.0)
    precio_mayorista: Mapped[float] = mapped_column(Float, default=0.0)
    largo_mm: Mapped[float | None] = mapped_column(Float, nullable=True)  # Dimensión en mm
    ancho_mm: Mapped[float | None] = mapped_column(Float, nullable=True)   # Dimensión en mm
    ubicacion: Mapped[str] = mapped_column(String(64), nullable=True)
    notas: Mapped[str] = mapped_column(String(512), nullable=True)

class Retazo(Base):
    __tablename__ = "retazos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    largo: Mapped[int] = mapped_column(Integer)  # Dimensión en mm
    ancho: Mapped[int] = mapped_column(Integer)  # Dimensión en mm
    espesor: Mapped[int] = mapped_column(Integer, nullable=True)
    ubicacion: Mapped[str] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="disponible")
    en_venta: Mapped[bool] = mapped_column(Boolean, default=False)
    precio: Mapped[float] = mapped_column(Float, nullable=True)
    reservado_por: Mapped[str] = mapped_column(String(36), nullable=True)
    reservado_hasta: Mapped[str] = mapped_column(String(64), nullable=True)
    
    # Dimensiones en mm
    origen_x_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    origen_y_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Área calculada en mm²
    area_mm2: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Estados possibles: disponible, reservado, vendido, descartado
    estado_inventario: Mapped[str] = mapped_column(String(32), default="disponible")
    
    # Timestamp de creación
    fecha_creacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    
    # Notas del operario
    notas_retazo: Mapped[str | None] = mapped_column(String(255), nullable=True)

class ProductoEstatico(Base):
    __tablename__ = "productos_estaticos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255), unique=True)
    descripcion: Mapped[str] = mapped_column(String(512), nullable=True)
    precio_venta: Mapped[float] = mapped_column(Float)
    categoria: Mapped[str] = mapped_column(String(100), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    fecha_actualizacion: Mapped[str] = mapped_column(String(64), nullable=True)

class MovimientoInventario(Base):
    __tablename__ = "inventario_movimientos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo: Mapped[str] = mapped_column(String(16))
    proveedor: Mapped[str] = mapped_column(String(255))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    cantidad: Mapped[int] = mapped_column(Integer)
    monto: Mapped[float] = mapped_column(Float)
    fecha: Mapped[str] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(16), default="activo")
    retazo_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

# --- PRESUPUESTOS ---
class Presupuesto(Base):
    __tablename__ = "presupuestos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    observaciones: Mapped[str] = mapped_column(String(1024), nullable=True)
    coordenadas: Mapped[str] = mapped_column(String(255), nullable=True)
    archivos_adjuntos: Mapped[str] = mapped_column(String(4096), nullable=True)
    anexos_imagenes_json: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    total: Mapped[float] = mapped_column(Float)
    estado_pago: Mapped[str] = mapped_column(String(32), default="pendiente")
    monto_cobrado: Mapped[float] = mapped_column(Float, default=0.0)
    fecha_creacion: Mapped[str | None] = mapped_column(String(64), nullable=True)
    aceptado_venta: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_aceptado: Mapped[str | None] = mapped_column(String(64), nullable=True)
    archivado: Mapped[bool] = mapped_column(Boolean, default=False)

class PresupuestoLinea(Base):
    __tablename__ = "presupuesto_lineas"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    tipo: Mapped[str] = mapped_column(String(32), default="material")
    material_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    producto_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    accesorio_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    material: Mapped[str] = mapped_column(String(255), default="")
    metros_cuadrados: Mapped[float] = mapped_column(Float)
    unidad: Mapped[str] = mapped_column(String(32), default="m²")
    cantidad: Mapped[float | None] = mapped_column(Float, nullable=True)
    medidas: Mapped[str] = mapped_column(String(255), nullable=True)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=True)
    condiciones: Mapped[str] = mapped_column(String(255), nullable=True)
    cortes_especiales: Mapped[bool] = mapped_column(Boolean, default=False)
    agujeros: Mapped[int] = mapped_column(Integer, nullable=True)
    recargo_extra: Mapped[float] = mapped_column(Float, nullable=True)
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True)
    geometria_json: Mapped[str] = mapped_column(String(8192), nullable=True)
    planos_manual_json: Mapped[str] = mapped_column(Text, nullable=True)

class PresupuestoMeta(Base):
    __tablename__ = "presupuesto_meta"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    data_json: Mapped[str] = mapped_column(String(8192))

# --- PLANOS ---
class PlanoClienteMaterial(Base):
    __tablename__ = "planos_cliente_material"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    material: Mapped[str] = mapped_column(String(255), index=True)
    imagen: Mapped[str] = mapped_column(Text, nullable=True)
    aprobado: Mapped[bool] = mapped_column(Boolean, default=False)
    firmado_por: Mapped[str] = mapped_column(String(255), nullable=True)
    medidas: Mapped[str] = mapped_column(Text, nullable=True)

class PlanoTecnico(Base):
    __tablename__ = "planos_tecnicos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    proyecto: Mapped[str] = mapped_column(String(255), nullable=True)
    categoria: Mapped[str] = mapped_column(String(64), default="General")
    estado: Mapped[str] = mapped_column(String(32), default="borrador")
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    ultimo_archivo: Mapped[str] = mapped_column(String(512), nullable=True)
    tipo: Mapped[str] = mapped_column(String(32), default="manual")
    contenido_json: Mapped[str] = mapped_column(Text, nullable=True)

class PlanoRevision(Base):
    __tablename__ = "planos_revisiones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plano_id: Mapped[str] = mapped_column(String(36), index=True)
    version: Mapped[int] = mapped_column(Integer)
    archivo_url: Mapped[str] = mapped_column(String(512))
    fecha_subida: Mapped[str] = mapped_column(String(64))
    comentarios: Mapped[str] = mapped_column(String(1024), nullable=True)
    subido_por: Mapped[str] = mapped_column(String(255), nullable=True)

# --- SERVICIOS ---
class Servicio(Base):
    __tablename__ = "servicios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    descripcion: Mapped[str] = mapped_column(String(512), nullable=True)
    categoria: Mapped[str] = mapped_column(String(64), default="General")
    precio_base: Mapped[float] = mapped_column(Float, default=0.0)
    unidad: Mapped[str] = mapped_column(String(32), default="global")
    proveedor_id: Mapped[str] = mapped_column(String(36), nullable=True)
    tiempo_estimado: Mapped[str] = mapped_column(String(64), nullable=True)
    disponible: Mapped[bool] = mapped_column(Boolean, default=True)
    detalles_tecnicos: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=True)
    observaciones: Mapped[str] = mapped_column(String(512), nullable=True)

class PrestacionServicio(Base):
    __tablename__ = "prestaciones_servicios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo_unico: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    servicio_id: Mapped[str] = mapped_column(String(36), index=True)
    servicio_nombre: Mapped[str] = mapped_column(String(255), nullable=True)
    presupuesto_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha_prestacion: Mapped[str] = mapped_column(String(64), nullable=True)
    costo: Mapped[float] = mapped_column(Float, default=0.0)
    estado: Mapped[str] = mapped_column(String(32), default="pendiente")
    aprobado_por: Mapped[str] = mapped_column(String(255), nullable=True)
    firma_digital: Mapped[str] = mapped_column(String(512), nullable=True)
    notas: Mapped[str] = mapped_column(String(512), nullable=True)

# --- FINANZAS ---
class Pago(Base):
    __tablename__ = "pagos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    monto: Mapped[float] = mapped_column(Float)
    metodo_pago: Mapped[str] = mapped_column(String(64))
    referencia: Mapped[str] = mapped_column(String(255), nullable=True)
    fecha_registro: Mapped[str] = mapped_column(String(64))
    estado: Mapped[str] = mapped_column(String(32), default="pendiente")
    confirmado_por: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha_confirmacion: Mapped[str] = mapped_column(String(64), nullable=True)
    nota: Mapped[str] = mapped_column(String(500), nullable=True)

    @property
    def fecha(self):
        return self.fecha_registro

class Suscripcion(Base):
    __tablename__ = "suscripciones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    monto_cuota: Mapped[float] = mapped_column(Float)
    frecuencia: Mapped[str] = mapped_column(String(20))
    dia_cobro: Mapped[int] = mapped_column(Integer)
    proximo_cobro: Mapped[datetime] = mapped_column(DateTime)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

class CuentaCorrienteMovimiento(Base):
    __tablename__ = "cc_movimientos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    tipo: Mapped[str] = mapped_column(String(20))
    monto: Mapped[float] = mapped_column(Float)
    referencia_id: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    saldo_historico: Mapped[float] = mapped_column(Float)

# --- AUDITORÍA ---
class CambioEstadoAuditoria(Base):
    """
    Tabla de auditoría centralizada para todos los cambios de estado.
    
    Registra:
    - Qué objeto cambió (tabla_afectada, registro_id)
    - De qué estado a qué estado
    - Quién lo cambió (usuario_id)
    - Cuándo (timestamp)
    - Por qué (razon)
    
    Permite trazabilidad completa de transiciones de estado.
    """
    __tablename__ = "cambios_estado_auditoria"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Identificación del objeto afectado
    tabla_afectada: Mapped[str] = mapped_column(String(64), index=True)
    # Valores: "trabajo", "acumulado_produccion", "pieza_trabajo", "retazo", "placa", etc
    
    registro_id: Mapped[str] = mapped_column(String(36), index=True)
    # ID del objeto (trabajo.id, acumulado.id, etc)
    
    # Transición de estado
    estado_anterior: Mapped[str | None] = mapped_column(String(64), nullable=True)
    estado_nuevo: Mapped[str] = mapped_column(String(64))
    
    # Auditoría de usuario
    usuario_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    # ID del usuario que realizó el cambio
    
    # Metadata temporal
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    # Fecha/hora exacta del cambio
    
    razon: Mapped[str] = mapped_column(String(255))
    # Descripción breve del motivo (Ej: "corte_lienzo", "manual_operario", "validacion_jefe")
    
    # Datos adicionales (JSON para casos complejos)
    detalles_json: Mapped[str | None] = mapped_column(JSON, nullable=True)
    # Campo para almacenar info adicional en JSON
