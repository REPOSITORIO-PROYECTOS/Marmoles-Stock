"""add geometria_json to presupuesto_lineas

Revision ID: 0004_add_geometria_json
Revises: fcf29546dfb3
Create Date: 2025-12-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004_add_geometria_json'
down_revision = 'seed_admin_user'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('presupuesto_lineas', sa.Column('geometria_json', sa.String(length=8192), nullable=True))

def downgrade() -> None:
    op.drop_column('presupuesto_lineas', 'geometria_json')
