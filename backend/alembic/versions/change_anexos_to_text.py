"""change anexos_imagenes_json to TEXT type

Revision ID: change_anexos_to_text
Revises: add_anexos_imagenes
Create Date: 2026-02-05 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'change_anexos_to_text'
down_revision = 'add_anexos_imagenes'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Change anexos_imagenes_json from VARCHAR(4096) to TEXT
    # PostgreSQL syntax
    op.alter_column('presupuestos', 'anexos_imagenes_json',
                    existing_type=sa.String(4096),
                    type_=sa.Text,
                    existing_nullable=True)

def downgrade() -> None:
    # Revert back to VARCHAR(4096)
    op.alter_column('presupuestos', 'anexos_imagenes_json',
                    existing_type=sa.Text,
                    type_=sa.String(4096),
                    existing_nullable=True)
