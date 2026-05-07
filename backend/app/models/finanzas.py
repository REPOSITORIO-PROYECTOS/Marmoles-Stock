import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .finanzas_produccion import Pago

class Suscripcion(Base):
    __tablename__ = "suscripciones"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    monto_cuota: Mapped[float] = mapped_column(Float)
    frecuencia: Mapped[str] = mapped_column(String(20)) # semanal, quincenal, mensual
    dia_cobro: Mapped[int] = mapped_column(Integer)
    proximo_cobro: Mapped[datetime] = mapped_column(DateTime)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

class CuentaCorrienteMovimiento(Base):
    """Tracks movements in the current account (credit usage/payments) separate from specific budgets if needed, 
    but for now, we can derive balance from Presupuestos - Pagos. 
    However, a specific ledger is better for 'Cuentas Corrientes'."""
    __tablename__ = "cc_movimientos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cliente_id: Mapped[str] = mapped_column(String(36), index=True)
    tipo: Mapped[str] = mapped_column(String(20)) # "debito" (charge), "credito" (payment)
    monto: Mapped[float] = mapped_column(Float)
    referencia_id: Mapped[str] = mapped_column(String(36), nullable=True) # Presupuesto ID or Pago ID
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    saldo_historico: Mapped[float] = mapped_column(Float) # Balance after this movement

class HistorialDescuentos(Base):
    """Historial de descuentos aplicados en presupuestos para auditoría y análisis"""
    __tablename__ = "historial_descuentos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    presupuesto_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    cliente_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    usuario_id: Mapped[str] = mapped_column(String(36), nullable=True, index=True)
    tipo_descuento: Mapped[str] = mapped_column(String(20), nullable=False)  # 'fijo' o 'porcentaje'
    valor_descuento: Mapped[float] = mapped_column(Float, nullable=False)
    monto_original: Mapped[float] = mapped_column(Float, nullable=False)
    monto_con_descuento: Mapped[float] = mapped_column(Float, nullable=False)
    monto_descontado: Mapped[float] = mapped_column(Float, nullable=False)
    motivo: Mapped[str] = mapped_column(String(512), nullable=True)
    fecha_aplicacion: Mapped[str] = mapped_column(String(64), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default='aplicado')  # 'aplicado', 'cancelado'
