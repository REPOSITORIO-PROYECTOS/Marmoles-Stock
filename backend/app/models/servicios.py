from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, Boolean, JSON
from .base import Base
import uuid

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
    # Campos adicionales para catálogo profesional
    detalles_tecnicos: Mapped[dict] = mapped_column(JSON, nullable=True) # {requisitos: string, beneficios: string[], opciones: string[]}
    observaciones: Mapped[str] = mapped_column(String(512), nullable=True)

class PrestacionServicio(Base):
    __tablename__ = "prestaciones_servicios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo_unico: Mapped[str] = mapped_column(String(64), unique=True, index=True) # e.g. SRV-2024-001
    servicio_id: Mapped[str] = mapped_column(String(36), index=True)
    servicio_nombre: Mapped[str] = mapped_column(String(255), nullable=True) # Snapshot of name
    presupuesto_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha_prestacion: Mapped[str] = mapped_column(String(64), nullable=True)
    costo: Mapped[float] = mapped_column(Float, default=0.0)
    estado: Mapped[str] = mapped_column(String(32), default="pendiente") # pendiente, realizado, aprobado
    aprobado_por: Mapped[str] = mapped_column(String(255), nullable=True)
    firma_digital: Mapped[str] = mapped_column(String(512), nullable=True)
    notas: Mapped[str] = mapped_column(String(512), nullable=True)
