from alembic import op
import sqlalchemy as sa

revision = 'manual_full_update_04'
down_revision = 'manual_full_update_03'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # PRESUPUESTO_LINEAS
    plineas_cols = [c['name'] for c in inspector.get_columns('presupuesto_lineas')]
    if 'geometria_json' not in plineas_cols:
        op.add_column('presupuesto_lineas', sa.Column('geometria_json', sa.String(length=8192), nullable=True))

def downgrade():
    pass
