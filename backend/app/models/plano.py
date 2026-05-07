import uuid
from sqlalchemy import String, Boolean, Text, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

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
    categoria: Mapped[str] = mapped_column(String(64), default="General") # Arquitectura, Corte, Detalle
    estado: Mapped[str] = mapped_column(String(32), default="borrador") # borrador, revision, aprobado, obsoleto
    fecha_creacion: Mapped[str] = mapped_column(String(64), nullable=True)
    ultimo_archivo: Mapped[str] = mapped_column(String(512), nullable=True) # URL del archivo mas reciente
    tipo: Mapped[str] = mapped_column(String(32), default="manual") # manual, automatico
    contenido_json: Mapped[str] = mapped_column(Text, nullable=True) # Datos vectoriales para el canvas

class PlanoRevision(Base):
    __tablename__ = "planos_revisiones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    plano_id: Mapped[str] = mapped_column(String(36), index=True)
    version: Mapped[int] = mapped_column(Integer)
    archivo_url: Mapped[str] = mapped_column(String(512))
    fecha_subida: Mapped[str] = mapped_column(String(64))
    comentarios: Mapped[str] = mapped_column(String(1024), nullable=True)
    subido_por: Mapped[str] = mapped_column(String(255), nullable=True)



