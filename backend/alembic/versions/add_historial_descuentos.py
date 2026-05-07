"""add historial descuentos

Revision ID: add_historial_descuentos
Revises: 
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_historial_descuentos'
down_revision = 'add_price_mayorista'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'historial_descuentos',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('presupuesto_id', sa.String(36), nullable=False, index=True),
        sa.Column('cliente_id', sa.String(36), nullable=True, index=True),
        sa.Column('usuario_id', sa.String(36), nullable=True, index=True),
        sa.Column('tipo_descuento', sa.String(20), nullable=False),  # 'fijo' o 'porcentaje'
        sa.Column('valor_descuento', sa.Float, nullable=False),
        sa.Column('monto_original', sa.Float, nullable=False),
        sa.Column('monto_con_descuento', sa.Float, nullable=False),
        sa.Column('monto_descontado', sa.Float, nullable=False),
        sa.Column('motivo', sa.String(512), nullable=True),
        sa.Column('fecha_aplicacion', sa.String(64), nullable=False),
        sa.Column('estado', sa.String(20), default='aplicado'),  # 'aplicado', 'cancelado'
    )


def downgrade():
    op.drop_table('historial_descuentos')
