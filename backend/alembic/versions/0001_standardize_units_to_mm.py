"""Standardize all dimensional units to millimeters (mm)

Rename columns in Material and Lote:
- ancho_m → ancho_mm (value * 1000)
- largo_m → largo_mm (value * 1000)

Revision ID: 0001_standardize_units_to_mm
Revises: f2842c5cf4c2
Create Date: 2026-04-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0001_standardize_units_to_mm'
down_revision = 'f2842c5cf4c2'
branch_labels = None
depends_on = None


def upgrade():
    """
    Upgrade: Convert all meter dimensions to millimeters.
    Strategy:
    1. Create new columns in mm with NULL values
    2. Copy and convert data from old columns (value * 1000)
    3. Set new columns as NOT NULL with CHECK constraint
    4. Drop old columns
    5. Rename new columns to final names
    """
    
    # ===== MATERIAL TABLE =====
    # Add temporary new columns for material
    op.add_column('materiales', sa.Column('ancho_mm_new', sa.Float, nullable=True))
    op.add_column('materiales', sa.Column('largo_mm_new', sa.Float, nullable=True))
    
    # Copy and convert data from meters to mm (multiply by 1000)
    op.execute("""
        UPDATE materiales 
        SET ancho_mm_new = CASE WHEN ancho_m IS NOT NULL THEN ancho_m * 1000 ELSE NULL END,
            largo_mm_new = CASE WHEN largo_m IS NOT NULL THEN largo_m * 1000 ELSE NULL END
    """)
    
    # Drop old columns
    op.drop_column('materiales', 'ancho_m')
    op.drop_column('materiales', 'largo_m')
    
    # Rename new columns to final names (sans _new suffix)
    op.execute("ALTER TABLE materiales RENAME COLUMN ancho_mm_new TO ancho_mm")
    op.execute("ALTER TABLE materiales RENAME COLUMN largo_mm_new TO largo_mm")
    
    # ===== LOTE TABLE =====
    # Add temporary new columns for lotes
    op.add_column('lotes', sa.Column('ancho_mm_new', sa.Float, nullable=True))
    op.add_column('lotes', sa.Column('largo_mm_new', sa.Float, nullable=True))
    
    # Copy and convert data from meters to mm (multiply by 1000)
    op.execute("""
        UPDATE lotes 
        SET ancho_mm_new = CASE WHEN ancho_m IS NOT NULL THEN ancho_m * 1000 ELSE NULL END,
            largo_mm_new = CASE WHEN largo_m IS NOT NULL THEN largo_m * 1000 ELSE NULL END
    """)
    
    # Drop old columns
    op.drop_column('lotes', 'ancho_m')
    op.drop_column('lotes', 'largo_m')
    
    # Rename new columns to final names
    op.execute("ALTER TABLE lotes RENAME COLUMN ancho_mm_new TO ancho_mm")
    op.execute("ALTER TABLE lotes RENAME COLUMN largo_mm_new TO largo_mm")


def downgrade():
    """
    Downgrade: Revert to meter dimensions.
    Strategy:
    1. Create new columns with old names (in meters)
    2. Copy and convert data back (value / 1000)
    3. Drop mm columns
    4. Rename new columns to final names
    """
    
    # ===== MATERIAL TABLE =====
    op.add_column('materiales', sa.Column('ancho_m_new', sa.Float, nullable=True))
    op.add_column('materiales', sa.Column('largo_m_new', sa.Float, nullable=True))
    
    # Copy and convert back from mm to meters (divide by 1000)
    op.execute("""
        UPDATE materiales 
        SET ancho_m_new = CASE WHEN ancho_mm IS NOT NULL THEN ancho_mm / 1000 ELSE NULL END,
            largo_m_new = CASE WHEN largo_mm IS NOT NULL THEN largo_mm / 1000 ELSE NULL END
    """)
    
    op.drop_column('materiales', 'ancho_mm')
    op.drop_column('materiales', 'largo_mm')
    
    op.execute("ALTER TABLE materiales RENAME COLUMN ancho_m_new TO ancho_m")
    op.execute("ALTER TABLE materiales RENAME COLUMN largo_m_new TO largo_m")
    
    # ===== LOTE TABLE =====
    op.add_column('lotes', sa.Column('ancho_m_new', sa.Float, nullable=True))
    op.add_column('lotes', sa.Column('largo_m_new', sa.Float, nullable=True))
    
    # Copy and convert back
    op.execute("""
        UPDATE lotes 
        SET ancho_m_new = CASE WHEN ancho_mm IS NOT NULL THEN ancho_mm / 1000 ELSE NULL END,
            largo_m_new = CASE WHEN largo_mm IS NOT NULL THEN largo_mm / 1000 ELSE NULL END
    """)
    
    op.drop_column('lotes', 'ancho_mm')
    op.drop_column('lotes', 'largo_mm')
    
    op.execute("ALTER TABLE lotes RENAME COLUMN ancho_m_new TO ancho_m")
    op.execute("ALTER TABLE lotes RENAME COLUMN largo_m_new TO largo_m")
