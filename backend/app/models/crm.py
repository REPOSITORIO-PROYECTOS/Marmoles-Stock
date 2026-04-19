import uuid
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

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
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    cliente_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)  # Vinculación directa al cliente

class Oportunidad(Base):
    __tablename__ = "oportunidades"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    estado: Mapped[str] = mapped_column(String(32), default="abierta")
    monto_estimado: Mapped[float]

class Actividad(Base):
    __tablename__ = "actividades"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    oportunidad_id: Mapped[str] = mapped_column(String(36), index=True)
    tipo: Mapped[str] = mapped_column(String(64))
    nota: Mapped[str] = mapped_column(String(1024))
