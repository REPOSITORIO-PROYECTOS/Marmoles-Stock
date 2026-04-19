"""add plan columns to acumulados produccion

Revision ID: add_plan_columns
Revises: 
Create Date: 2026-02-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_plan_columns'
down_revision = '999999999999'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns to acumulados_produccion table
    op.add_column('acumulados_produccion', sa.Column('plan_img_url', sa.String(512), nullable=True))
    op.add_column('acumulados_produccion', sa.Column('plan_dxf_url', sa.String(512), nullable=True))
    op.add_column('acumulados_produccion', sa.Column('utilization', sa.Float(), nullable=True, server_default='0.0'))


def downgrade() -> None:
    # Remove columns if needed
    op.drop_column('acumulados_produccion', 'utilization')
    op.drop_column('acumulados_produccion', 'plan_dxf_url')
    op.drop_column('acumulados_produccion', 'plan_img_url')
