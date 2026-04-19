"""add fecha_registro and other columns

Revision ID: 999999999999
Revises: f2842c5cf4c2
Create Date: 2026-01-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '999999999999'
down_revision = 'f2842c5cf4c2'
branch_labels = None
depends_on = None


def upgrade():
    # pagos
    op.add_column('pagos', sa.Column('fecha_registro', sa.String(length=64), nullable=True))
    op.add_column('pagos', sa.Column('estado', sa.String(length=32), server_default='pendiente', nullable=False))
    op.add_column('pagos', sa.Column('confirmado_por', sa.String(length=36), nullable=True))
    op.add_column('pagos', sa.Column('fecha_confirmacion', sa.String(length=64), nullable=True))
    
    # visitas_tecnicas
    op.add_column('visitas_tecnicas', sa.Column('trabajo_id', sa.String(length=36), nullable=True))
    op.add_column('visitas_tecnicas', sa.Column('fecha', sa.String(length=64), nullable=True))
    op.add_column('visitas_tecnicas', sa.Column('fotos_drive', sa.JSON(), nullable=True))
    op.add_column('visitas_tecnicas', sa.Column('medidas_definitivas', sa.JSON(), nullable=True))
    
    # indices
    op.create_index(op.f('ix_visitas_tecnicas_trabajo_id'), 'visitas_tecnicas', ['trabajo_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_visitas_tecnicas_trabajo_id'), table_name='visitas_tecnicas')
    op.drop_column('visitas_tecnicas', 'medidas_definitivas')
    op.drop_column('visitas_tecnicas', 'fotos_drive')
    op.drop_column('visitas_tecnicas', 'fecha')
    op.drop_column('visitas_tecnicas', 'trabajo_id')
    
    op.drop_column('pagos', 'fecha_confirmacion')
    op.drop_column('pagos', 'confirmado_por')
    op.drop_column('pagos', 'estado')
    op.drop_column('pagos', 'fecha_registro')
