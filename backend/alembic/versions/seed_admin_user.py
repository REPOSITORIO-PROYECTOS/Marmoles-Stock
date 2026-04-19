from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
import os
import hashlib
import base64
import uuid

revision = 'seed_admin_user'
down_revision = 'fcf29546dfb3'
branch_labels = None
depends_on = None

def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200000)
    return base64.b64encode(dk).decode()

def upgrade():
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        username = 'admin'
        salt = os.urandom(16).hex()
        pwd = _hash_password('marmoles123', salt)
        exists = session.execute(sa.text("SELECT 1 FROM users WHERE username=:u"), {"u": username}).scalar()
        if not exists:
            session.execute(
                sa.text(
                    """
                    INSERT INTO users (id, username, email, password_hash, password_salt, role, active, failed_attempts, locked_until)
                    VALUES (:id, :username, :email, :password_hash, :password_salt, :role, :active, :failed_attempts, :locked_until)
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "username": username,
                    "email": "admin@example.com",
                    "password_hash": pwd,
                    "password_salt": salt,
                    "role": "admin",
                    "active": True,
                    "failed_attempts": 0,
                    "locked_until": None,
                },
            )
            session.commit()
    finally:
        session.close()

def downgrade():
    op.execute(sa.text("DELETE FROM users WHERE username='admin'"))
