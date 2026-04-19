"""add anexos_imagenes_json column to presupuestos

Revision ID: add_anexos_imagenes
Revises: add_plan_columns
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_anexos_imagenes'
down_revision = 'add_plan_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add anexos_imagenes_json column to presupuestos table
    op.add_column('presupuestos', sa.Column('anexos_imagenes_json', sa.String(4096), nullable=True))


def downgrade() -> None:
    # Remove column if needed
    op.drop_column('presupuestos', 'anexos_imagenes_json')
