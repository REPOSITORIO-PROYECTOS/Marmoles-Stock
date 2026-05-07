"""add price_mayorista to lotes and productos_estaticos

Revision ID: add_price_mayorista
Revises: add_activo_mat_001
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_price_mayorista'
down_revision = 'add_activo_mat_001'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar campos a tabla lotes
    op.add_column('lotes', sa.Column('precio_venta', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('lotes', sa.Column('precio_mayorista', sa.Float(), nullable=False, server_default='0.0'))
    
    # Agregar campo a tabla productos_estaticos
    op.add_column('productos_estaticos', sa.Column('precio_mayorista', sa.Float(), nullable=False, server_default='0.0'))


def downgrade():
    # Eliminar campos
    op.drop_column('lotes', 'precio_mayorista')
    op.drop_column('lotes', 'precio_venta')
    op.drop_column('productos_estaticos', 'precio_mayorista')
