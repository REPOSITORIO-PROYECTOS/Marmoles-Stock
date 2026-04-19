#!/usr/bin/env python3
"""
Script para aplicar directamente los cambios a la base de datos PostgreSQL
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Obtener DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://marmoles_user:marmoles_password@127.0.0.1:5432/marmoles_db")

print(f"Conectando a: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'base de datos'}")

try:
    engine = create_engine(DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    print("\n🔧 Aplicando cambios a la tabla presupuestos...\n")
    
    # Obtener columnas actuales
    result = db.execute(text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='presupuestos'
    """))
    columns = {row[0] for row in result}
    print(f"Columnas actuales: {columns}\n")
    
    statements = []
    
    # Agregar aceptado_venta si no existe
    if "aceptado_venta" not in columns:
        print("✦ Agregando columna aceptado_venta...")
        db.execute(text("ALTER TABLE presupuestos ADD COLUMN aceptado_venta BOOLEAN DEFAULT FALSE"))
        print("  ✓ Columna aceptado_venta agregada\n")
    else:
        print("  ✓ Columna aceptado_venta ya existe\n")
    
    # Agregar fecha_aceptado si no existe
    if "fecha_aceptado" not in columns:
        print("✦ Agregando columna fecha_aceptado...")
        db.execute(text("ALTER TABLE presupuestos ADD COLUMN fecha_aceptado VARCHAR(64)"))
        print("  ✓ Columna fecha_aceptado agregada\n")
    else:
        print("  ✓ Columna fecha_aceptado ya existe\n")
    
    # Agregar archivado si no existe
    if "archivado" not in columns:
        print("✦ Agregando columna archivado...")
        db.execute(text("ALTER TABLE presupuestos ADD COLUMN archivado BOOLEAN DEFAULT FALSE"))
        print("  ✓ Columna archivado agregada\n")
    else:
        print("  ✓ Columna archivado ya existe\n")
    
    # Agregar anexos_imagenes_json si no existe
    if "anexos_imagenes_json" not in columns:
        print("✦ Agregando columna anexos_imagenes_json...")
        db.execute(text("ALTER TABLE presupuestos ADD COLUMN anexos_imagenes_json VARCHAR(4096)"))
        print("  ✓ Columna anexos_imagenes_json agregada\n")
    else:
        print("  ✓ Columna anexos_imagenes_json ya existe\n")
    
    db.commit()
    db.close()
    
    print("✅ Migración completada exitosamente!")
    print("\nAhora puedes crear pagos desde presupuestos aceptados.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
