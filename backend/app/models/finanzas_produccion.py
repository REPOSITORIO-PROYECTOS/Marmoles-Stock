import uuid
from sqlalchemy import String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base

class Pago(Base):
    __tablename__ = "pagos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    monto: Mapped[float] = mapped_column(Float)
    metodo_pago: Mapped[str] = mapped_column(String(64))  # Transferencia, Cheque, Efectivo, Tarjeta
    referencia: Mapped[str] = mapped_column(String(255), nullable=True) # Nro comprobante
    fecha: Mapped[str] = mapped_column(String(64), nullable=True)
    fecha_registro: Mapped[str] = mapped_column(String(64), nullable=True)
    estado: Mapped[str] = mapped_column(String(32), default="pendiente") # pendiente, confirmado, rechazado
    confirmado_por: Mapped[str] = mapped_column(String(36), nullable=True)
    fecha_confirmacion: Mapped[str] = mapped_column(String(64), nullable=True)
    nota: Mapped[str] = mapped_column(String(500), nullable=True)

