import uuid
from sqlalchemy import String, Float, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Material(Base):
    __tablename__ = "materiales"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255))
    precio_m2: Mapped[float] = mapped_column(Float)
    espesor_mm: Mapped[int] = mapped_column(Integer, nullable=True)
    color: Mapped[str] = mapped_column(String(64), nullable=True)
    ancho_m: Mapped[float] = mapped_column(Float, nullable=True)
    largo_m: Mapped[float] = mapped_column(Float, nullable=True)
    stock_actual: Mapped[float] = mapped_column(Float, default=0.0)
    unidad: Mapped[str] = mapped_column(String(16), default="m²")
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
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)

class Placa(Base):
    __tablename__ = "placas"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    ancho: Mapped[int] = mapped_column(Integer)
    largo: Mapped[int] = mapped_column(Integer)
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
    ancho_m: Mapped[float] = mapped_column(Float, nullable=True)
    largo_m: Mapped[float] = mapped_column(Float, nullable=True)
    ubicacion: Mapped[str] = mapped_column(String(64), nullable=True)
    notas: Mapped[str] = mapped_column(String(512), nullable=True)

class Retazo(Base):
    __tablename__ = "retazos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    material_id: Mapped[str] = mapped_column(String(36), index=True)
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    ancho: Mapped[int] = mapped_column(Integer)
    largo: Mapped[int] = mapped_column(Integer)
    espesor: Mapped[int] = mapped_column(Integer, nullable=True)
    ubicacion: Mapped[str] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="disponible")
    en_venta: Mapped[bool] = mapped_column(Boolean, default=False)
    precio: Mapped[float] = mapped_column(Float, nullable=True)
    reservado_por: Mapped[str] = mapped_column(String(36), nullable=True)
    reservado_hasta: Mapped[str] = mapped_column(String(64), nullable=True)
    geometria_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    area_mm2: Mapped[float | None] = mapped_column(Float, nullable=True)

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

class ProductoEstatico(Base):
    __tablename__ = "productos_estaticos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255), unique=True)
    descripcion: Mapped[str] = mapped_column(String(512), nullable=True)
    precio_venta: Mapped[float] = mapped_column(Float)
    precio_mayorista: Mapped[float] = mapped_column(Float, default=0.0)
    categoria: Mapped[str] = mapped_column(String(100), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    fecha_actualizacion: Mapped[str] = mapped_column(String(64), nullable=True)
