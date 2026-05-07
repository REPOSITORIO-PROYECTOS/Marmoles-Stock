from alembic import op
import sqlalchemy as sa

revision = 'manual_full_update_02'
down_revision = 'manual_coords_01'
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # TRABAJOS
    trabajos_cols = [c['name'] for c in inspector.get_columns('trabajos')]
    if 'prioridad' not in trabajos_cols:
        op.add_column('trabajos', sa.Column('prioridad', sa.String(length=16), nullable=False, server_default='normal'))
    if 'fecha_creacion' not in trabajos_cols:
        op.add_column('trabajos', sa.Column('fecha_creacion', sa.String(length=64), nullable=True))
    if 'visita_tecnica' not in trabajos_cols:
        op.add_column('trabajos', sa.Column('visita_tecnica', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    if 'aprobado_jefe' not in trabajos_cols:
        op.add_column('trabajos', sa.Column('aprobado_jefe', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    if 'sena_abonada' not in trabajos_cols:
        op.add_column('trabajos', sa.Column('sena_abonada', sa.Boolean(), nullable=False, server_default=sa.text('0')))

    # CLIENTES
    clientes_cols = [c['name'] for c in inspector.get_columns('clientes')]
    if 'es_cuenta_corriente' not in clientes_cols:
        op.add_column('clientes', sa.Column('es_cuenta_corriente', sa.Boolean(), nullable=False, server_default=sa.text('0')))
    if 'limite_credito' not in clientes_cols:
        op.add_column('clientes', sa.Column('limite_credito', sa.Float(), nullable=False, server_default='0.0'))
    if 'saldo_actual' not in clientes_cols:
        op.add_column('clientes', sa.Column('saldo_actual', sa.Float(), nullable=False, server_default='0.0'))

    # PIEZAS_TRABAJO
    piezas_cols = [c['name'] for c in inspector.get_columns('piezas_trabajo')]
    if 'ubicacion_estanteria' not in piezas_cols:
        op.add_column('piezas_trabajo', sa.Column('ubicacion_estanteria', sa.String(length=32), nullable=True))

    # PLACAS
    placas_cols = [c['name'] for c in inspector.get_columns('placas')]
    if 'lote_id' not in placas_cols:
        op.add_column('placas', sa.Column('lote_id', sa.String(length=36), nullable=True))
        # Add index if possible, though sqlite handling of indexes in migrations can be tricky, simple add_column is safer for now.
        # op.create_index(op.f('ix_placas_lote_id'), 'placas', ['lote_id'], unique=False)

    # PRESUPUESTO_LINEAS
    plineas_cols = [c['name'] for c in inspector.get_columns('presupuesto_lineas')]
    if 'lote_id' not in plineas_cols:
        op.add_column('presupuesto_lineas', sa.Column('lote_id', sa.String(length=36), nullable=True))


def downgrade():
    # Downgrade logic typically drops columns, but for manual catch-up migrations it's often omitted or simplified.
    pass
