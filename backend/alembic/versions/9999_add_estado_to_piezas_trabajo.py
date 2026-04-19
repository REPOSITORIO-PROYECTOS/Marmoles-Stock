"""add_estado_to_piezas_trabajo

Revision ID: 9999_add_estado_to_piezas
Revises: 437ec914f94a
Create Date: 2026-02-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9999_add_estado_to_piezas'
down_revision: Union[str, None] = '437ec914f94a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agregar columna estado a piezas_trabajo
    op.add_column('piezas_trabajo', sa.Column('estado', sa.String(32), nullable=False, server_default='pendiente'))


def downgrade() -> None:
    # Eliminar columna estado de piezas_trabajo
    op.drop_column('piezas_trabajo', 'estado')
