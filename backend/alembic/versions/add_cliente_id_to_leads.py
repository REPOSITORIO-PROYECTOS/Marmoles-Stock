"""add cliente_id to leads

Revision ID: add_cliente_id_leads
Revises: 9999_add_fecha_registro
Create Date: 2026-02-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_cliente_id_leads'
down_revision = '999999999999'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna cliente_id a tabla leads
    op.add_column('leads', sa.Column('cliente_id', sa.String(36), nullable=True))
    # Crear índice para búsquedas rápidas
    op.create_index('ix_leads_cliente_id', 'leads', ['cliente_id'])


def downgrade():
    # Eliminar índice
    op.drop_index('ix_leads_cliente_id', table_name='leads')
    # Eliminar columna
    op.drop_column('leads', 'cliente_id')
