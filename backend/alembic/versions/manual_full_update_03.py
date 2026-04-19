from alembic import op
import sqlalchemy as sa

revision = 'manual_full_update_03'
down_revision = 'manual_full_update_02'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # CLIENTES
    clientes_cols = [c['name'] for c in inspector.get_columns('clientes')]
    if 'coordenadas' not in clientes_cols:
        op.add_column('clientes', sa.Column('coordenadas', sa.String(length=255), nullable=True))

    # LEADS
    leads_cols = [c['name'] for c in inspector.get_columns('leads')]
    if 'coordenadas' not in leads_cols:
        op.add_column('leads', sa.Column('coordenadas', sa.String(length=255), nullable=True))

def downgrade():
    pass
