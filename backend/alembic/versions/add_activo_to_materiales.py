"""add activo to materiales

Revision ID: add_activo_mat_001
Revises: 9999_add_estado_to_piezas
Create Date: 2026-02-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_activo_mat_001'
down_revision = '9999_add_estado_to_piezas'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna activo a la tabla materiales
    # Primero verificar si la columna ya existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('materiales')]
    
    if 'activo' not in columns:
        # Agregar columna con valor por defecto TRUE
        op.add_column('materiales', sa.Column('activo', sa.Boolean(), nullable=False, server_default='true'))
        
        # Actualizar todos los registros existentes para que tengan activo=TRUE
        op.execute("UPDATE materiales SET activo = true WHERE activo IS NULL")
        
        print("✅ Columna 'activo' agregada a la tabla 'materiales'")
    else:
        print("⚠️  La columna 'activo' ya existe en la tabla 'materiales'")


def downgrade():
    # Eliminar columna activo si existe
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('materiales')]
    
    if 'activo' in columns:
        op.drop_column('materiales', 'activo')
        print("✅ Columna 'activo' eliminada de la tabla 'materiales'")
    else:
        print("⚠️  La columna 'activo' no existe en la tabla 'materiales'")
