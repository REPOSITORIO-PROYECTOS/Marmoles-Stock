from alembic import op
import sqlalchemy as sa

revision = 'manual_coords_01'
down_revision = '0004_add_geometria_json'
branch_labels = None
depends_on = None

def upgrade():
    # Check if column exists to avoid error if run multiple times or if partial state
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('presupuestos')]
    if 'coordenadas' not in columns:
        op.add_column('presupuestos', sa.Column('coordenadas', sa.String(length=255), nullable=True))
    if 'archivos_adjuntos' not in columns:
         op.add_column('presupuestos', sa.Column('archivos_adjuntos', sa.String(length=4096), nullable=True))
    if 'estado_pago' not in columns:
         op.add_column('presupuestos', sa.Column('estado_pago', sa.String(length=32), nullable=False, server_default='pendiente'))
    if 'monto_cobrado' not in columns:
         op.add_column('presupuestos', sa.Column('monto_cobrado', sa.Float(), nullable=False, server_default='0.0'))

def downgrade():
    op.drop_column('presupuestos', 'monto_cobrado')
    op.drop_column('presupuestos', 'estado_pago')
    op.drop_column('presupuestos', 'archivos_adjuntos')
    op.drop_column('presupuestos', 'coordenadas')
