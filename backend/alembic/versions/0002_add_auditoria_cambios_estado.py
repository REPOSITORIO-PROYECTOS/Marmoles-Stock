"""Add CambioEstadoAuditoria table for tracking state transitions

Revision ID: 0002_add_auditoria_cambios_estado
Revises: 0001_standardize_units_to_mm
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0002_add_auditoria_cambios_estado'
down_revision = '0001_standardize_units_to_mm'
branch_labels = None
depends_on = None


def upgrade():
    """Create cambios_estado_auditoria table"""
    
    op.create_table(
        'cambios_estado_auditoria',
        sa.Column('id', sa.String(36), nullable=False, primary_key=True),
        sa.Column('tabla_afectada', sa.String(64), nullable=False, index=True),
        sa.Column('registro_id', sa.String(36), nullable=False, index=True),
        sa.Column('estado_anterior', sa.String(64), nullable=True),
        sa.Column('estado_nuevo', sa.String(64), nullable=False),
        sa.Column('usuario_id', sa.String(36), nullable=True, index=True),
        sa.Column('timestamp', sa.DateTime, nullable=False, index=True, server_default=sa.func.now()),
        sa.Column('razon', sa.String(255), nullable=False),
        sa.Column('detalles_json', sa.JSON, nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Index compuesto para búsquedas frecuentes (tabla + registro + timestamp)
    op.create_index(
        'ix_auditoria_tabla_registro',
        'cambios_estado_auditoria',
        ['tabla_afectada', 'registro_id']
    )
    
    # Index para búsquedas por timestamp (auditorías recientes)
    op.create_index(
        'ix_auditoria_timestamp_desc',
        'cambios_estado_auditoria',
        ['timestamp']
    )


def downgrade():
    """Drop cambios_estado_auditoria table"""
    
    op.drop_index('ix_auditoria_timestamp_desc', table_name='cambios_estado_auditoria')
    op.drop_index('ix_auditoria_tabla_registro', table_name='cambios_estado_auditoria')
    op.drop_table('cambios_estado_auditoria')
