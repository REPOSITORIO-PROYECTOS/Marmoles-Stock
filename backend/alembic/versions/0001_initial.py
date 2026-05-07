from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('username', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('password_salt', sa.String(length=64), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='ventas'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('failed_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    op.create_table(
        'sessions',
        sa.Column('token', sa.String(length=128), primary_key=True),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_sessions_user_id', 'sessions', ['user_id'])

def downgrade():
    op.drop_index('ix_sessions_user_id', table_name='sessions')
    op.drop_table('sessions')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')
