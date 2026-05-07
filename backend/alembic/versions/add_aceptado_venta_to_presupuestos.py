"""add aceptado_venta to presupuestos

Revision ID: add_aceptado_venta
Revises: 
Create Date: 2025-03-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_aceptado_venta'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists before adding it
    inspector = sa.inspect(op.get_bind())
    columns = [col['name'] for col in inspector.get_columns('presupuestos')]
    
    if 'aceptado_venta' not in columns:
        op.add_column('presupuestos', sa.Column('aceptado_venta', sa.Boolean(), nullable=False, server_default='0'))
    
    if 'fecha_aceptado' not in columns:
        op.add_column('presupuestos', sa.Column('fecha_aceptado', sa.String(64), nullable=True))
    
    if 'archivado' not in columns:
        op.add_column('presupuestos', sa.Column('archivado', sa.Boolean(), nullable=False, server_default='0'))
    
    if 'anexos_imagenes_json' not in columns:
        op.add_column('presupuestos', sa.Column('anexos_imagenes_json', sa.String(4096), nullable=True))


def downgrade() -> None:
    op.drop_column('presupuestos', 'aceptado_venta')
    op.drop_column('presupuestos', 'fecha_aceptado')
    op.drop_column('presupuestos', 'archivado')
    op.drop_column('presupuestos', 'anexos_imagenes_json')
