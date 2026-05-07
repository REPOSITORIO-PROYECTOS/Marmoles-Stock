"""add item types and new fields to presupuesto_linea

Revision ID: add_item_types_linea
Revises: add_anexos_imagenes
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_item_types_linea'
down_revision = 'add_anexos_imagenes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to presupuesto_lineas table
    op.add_column('presupuesto_lineas', sa.Column('tipo', sa.String(50), nullable=True, server_default='material'))
    op.add_column('presupuesto_lineas', sa.Column('material_id', sa.String(255), nullable=True))
    op.add_column('presupuesto_lineas', sa.Column('producto_id', sa.String(255), nullable=True))
    op.add_column('presupuesto_lineas', sa.Column('accesorio_id', sa.String(255), nullable=True))
    op.add_column('presupuesto_lineas', sa.Column('unidad', sa.String(20), nullable=True, server_default='m²'))
    op.add_column('presupuesto_lineas', sa.Column('cantidad', sa.Float, nullable=True))
    op.add_column('presupuesto_lineas', sa.Column('placa_completa', sa.Boolean, nullable=True, server_default=sa.false()))
    op.add_column('presupuesto_lineas', sa.Column('planos_manual_json', sa.Text, nullable=True))


def downgrade() -> None:
    # Remove columns if needed (only if rolling back)
    op.drop_column('presupuesto_lineas', 'planos_manual_json')
    op.drop_column('presupuesto_lineas', 'placa_completa')
    op.drop_column('presupuesto_lineas', 'cantidad')
    op.drop_column('presupuesto_lineas', 'unidad')
    op.drop_column('presupuesto_lineas', 'accesorio_id')
    op.drop_column('presupuesto_lineas', 'producto_id')
    op.drop_column('presupuesto_lineas', 'material_id')
    op.drop_column('presupuesto_lineas', 'tipo')
