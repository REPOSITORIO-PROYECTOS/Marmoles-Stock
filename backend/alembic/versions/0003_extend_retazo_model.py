"""Extend Retazo model with cut-related fields

Add fields to support automatic retazo generation from cuts:
- acumulado_produccion_id: FK to the AcumuladoProduccion that generated this retazo
- origen_x_mm, origen_y_mm: Position in the original plate
- area_mm2: Calculated area in mm²
- estado: Track availabilty (disponible, reservado, vendido, descartado)

Revision ID: 0003_extend_retazo_model
Revises: 0002_add_auditoria_cambios_estado
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0003_extend_retazo_model'
down_revision = '0002_add_auditoria_cambios_estado'
branch_labels = None
depends_on = None


def upgrade():
    """Add new columns to retazos table"""
    
    # FK a AcumuladoProduccion (opcional, para retazos generados automáticamente)
    op.add_column('retazos', sa.Column('acumulado_produccion_id', sa.String(36), nullable=True, index=True))
    
    # Posición en la plancha original (para tracking de dónde vino el retazo)
    op.add_column('retazos', sa.Column('origen_x_mm', sa.Float, nullable=True))
    op.add_column('retazos', sa.Column('origen_y_mm', sa.Float, nullable=True))
    
    # Área calculada en mm² (para búsquedas rápidas sin recalcular)
    op.add_column('retazos', sa.Column('area_mm2', sa.Float, nullable=True))
    
    # Mejorar campo 'estado' existente con más opciones
    # En PostgreSQL usaríamos ENUM, pero para generalidad usamos VARCHAR
    # Estados posibles: disponible (default), reservado, vendido, descartado
    op.add_column('retazos', sa.Column('estado_inventario', sa.String(32), default='disponible', nullable=False))
    
    # Auditoría: timestamp de creación
    op.add_column('retazos', sa.Column('fecha_creacion', sa.DateTime, nullable=True, server_default=sa.func.now()))
    
    # Notas sobre el retazo (si tiene defectos, si es útil para algo específico, etc)
    op.add_column('retazos', sa.Column('notas_retazo', sa.String(255), nullable=True))


def downgrade():
    """Remove new columns from retazos table"""
    
    op.drop_column('retazos', 'notas_retazo')
    op.drop_column('retazos', 'fecha_creacion')
    op.drop_column('retazos', 'estado_inventario')
    op.drop_column('retazos', 'area_mm2')
    op.drop_column('retazos', 'origen_y_mm')
    op.drop_column('retazos', 'origen_x_mm')
    op.drop_column('retazos', 'acumulado_produccion_id')
