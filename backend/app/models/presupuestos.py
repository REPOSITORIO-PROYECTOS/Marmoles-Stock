import uuid
from sqlalchemy import String, Float, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Presupuesto(Base):
    __tablename__ = "presupuestos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    observaciones: Mapped[str] = mapped_column(String(1024), nullable=True)
    coordenadas: Mapped[str] = mapped_column(String(255), nullable=True) # Google Maps coords
    archivos_adjuntos: Mapped[str] = mapped_column(String(4096), nullable=True) # JSON list of URLs
    anexos_imagenes_json: Mapped[str] = mapped_column(Text, nullable=True) # JSON list of plan images (base64 can be large)
    total: Mapped[float] = mapped_column(Float)
    aceptado_venta: Mapped[bool] = mapped_column(Boolean, default=False)
    fecha_aceptado: Mapped[str] = mapped_column(String(64), nullable=True)
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    estado_pago: Mapped[str] = mapped_column(String(32), default="pendiente") # pendiente, parcial, pagado
    monto_cobrado: Mapped[float] = mapped_column(Float, default=0.0)
    archivado: Mapped[bool] = mapped_column(Boolean, default=False)

class PresupuestoLinea(Base):
    __tablename__ = "presupuesto_lineas"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    # Tipo de ítem: material, producto, accesorio, extra
    tipo: Mapped[str] = mapped_column(String(50), default='material', nullable=True)
    # IDs de los diferentes tipos de ítems
    material_id: Mapped[str] = mapped_column(String(255), nullable=True)
    producto_id: Mapped[str] = mapped_column(String(255), nullable=True)
    accesorio_id: Mapped[str] = mapped_column(String(255), nullable=True)
    # Información del material (legacy)
    material: Mapped[str] = mapped_column(String(255))
    # Medidas y cantidad
    metros_cuadrados: Mapped[float] = mapped_column(Float)
    medidas: Mapped[str] = mapped_column(String(255), nullable=True)
    unidad: Mapped[str] = mapped_column(String(20), default='m²', nullable=True)
    cantidad: Mapped[float] = mapped_column(Float, nullable=True)
    # Precios
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=True)
    # Condiciones
    condiciones: Mapped[str] = mapped_column(String(255), nullable=True)
    cortes_especiales: Mapped[bool] = mapped_column(default=False)
    agujeros: Mapped[int] = mapped_column(nullable=True)
    recargo_extra: Mapped[float] = mapped_column(Float, nullable=True)
    # Lote y planos
    lote_id: Mapped[str] = mapped_column(String(36), nullable=True)
    placa_completa: Mapped[bool] = mapped_column(default=False)
    geometria_json: Mapped[str] = mapped_column(String(8192), nullable=True)
    planos_manual_json: Mapped[str] = mapped_column(Text, nullable=True)

class PresupuestoMeta(Base):
    __tablename__ = "presupuesto_meta"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    data_json: Mapped[str] = mapped_column(String(8192))
