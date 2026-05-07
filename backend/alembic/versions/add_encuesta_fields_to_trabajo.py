"""Add encuesta fields to trabajos table

Revision ID: add_encuesta_fields
Revises: 
Create Date: 2026-03-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_encuesta_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add encuesta-related fields to trabajos table
    op.add_column('trabajos', sa.Column('direccion', sa.String(512), nullable=True))
    # Sin unique en la columna: SQLite no soporta UNIQUE inline en ADD COLUMN; el índice único abajo alcanza.
    op.add_column('trabajos', sa.Column('encuesta_token', sa.String(128), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_generada_fecha', sa.String(64), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_completada', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('trabajos', sa.Column('encuesta_completada_fecha', sa.String(64), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_conformidad', sa.Boolean(), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_calificacion', sa.Integer(), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_comentarios', sa.String(2048), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_firma_cliente', sa.Text(), nullable=True))
    op.add_column('trabajos', sa.Column('encuesta_nombre_receptor', sa.String(255), nullable=True))
    
    # Create index on encuesta_token for fast lookups
    op.create_index('idx_encuesta_token', 'trabajos', ['encuesta_token'], unique=True)


def downgrade() -> None:
    # Remove encuesta-related fields
    op.drop_index('idx_encuesta_token', table_name='trabajos')
    op.drop_column('trabajos', 'encuesta_nombre_receptor')
    op.drop_column('trabajos', 'encuesta_firma_cliente')
    op.drop_column('trabajos', 'encuesta_comentarios')
    op.drop_column('trabajos', 'encuesta_calificacion')
    op.drop_column('trabajos', 'encuesta_conformidad')
    op.drop_column('trabajos', 'encuesta_completada_fecha')
    op.drop_column('trabajos', 'encuesta_completada')
    op.drop_column('trabajos', 'encuesta_generada_fecha')
    op.drop_column('trabajos', 'encuesta_token')
    op.drop_column('trabajos', 'direccion')
