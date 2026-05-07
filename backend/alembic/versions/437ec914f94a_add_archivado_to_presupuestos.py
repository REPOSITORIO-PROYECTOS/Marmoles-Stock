from alembic import op
import sqlalchemy as sa

revision = '437ec914f94a'
down_revision = '4bbc0aa926a4'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('presupuestos', sa.Column('archivado', sa.Boolean(), server_default='false', nullable=False))

def downgrade():
    op.drop_column('presupuestos', 'archivado')
