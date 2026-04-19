#!/usr/bin/env python3
"""
Script para aplicar directamente los cambios a la base de datos
sin necesidad de alembic
"""
import os
import sqlite3
import sys

# Obtener la ruta de la base de datos
db_path = os.path.join(os.path.dirname(__file__), "presupuestos.db")

if not os.path.exists(db_path):
    print(f"Error: Base de datos no encontrada en {db_path}")
    sys.exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("Agregando columnas faltantes a presupuestos...")
    
    # Obtener información actual de la tabla
    cursor.execute("PRAGMA table_info(presupuestos)")
    columns = {row[1] for row in cursor.fetchall()}
    
    print(f"Columnas actuales: {columns}")
    
    # Agregar aceptado_venta si no existe
    if "aceptado_venta" not in columns:
        print("Agregando columna aceptado_venta...")
        cursor.execute("ALTER TABLE presupuestos ADD COLUMN aceptado_venta BOOLEAN DEFAULT 0")
        print("✓ Columna aceptado_venta agregada")
    else:
        print("✓ Columna aceptado_venta ya existe")
    
    # Agregar fecha_aceptado si no existe
    if "fecha_aceptado" not in columns:
        print("Agregando columna fecha_aceptado...")
        cursor.execute("ALTER TABLE presupuestos ADD COLUMN fecha_aceptado VARCHAR(64)")
        print("✓ Columna fecha_aceptado agregada")
    else:
        print("✓ Columna fecha_aceptado ya existe")
    
    # Agregar archivado si no existe
    if "archivado" not in columns:
        print("Agregando columna archivado...")
        cursor.execute("ALTER TABLE presupuestos ADD COLUMN archivado BOOLEAN DEFAULT 0")
        print("✓ Columna archivado agregada")
    else:
        print("✓ Columna archivado ya existe")
    
    # Agregar anexos_imagenes_json si no existe
    if "anexos_imagenes_json" not in columns:
        print("Agregando columna anexos_imagenes_json...")
        cursor.execute("ALTER TABLE presupuestos ADD COLUMN anexos_imagenes_json VARCHAR(4096)")
        print("✓ Columna anexos_imagenes_json agregada")
    else:
        print("✓ Columna anexos_imagenes_json ya existe")
    
    conn.commit()
    conn.close()
    
    print("\n✅ Migración completada exitosamente!")
    
except sqlite3.OperationalError as e:
    print(f"❌ Error SQL: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
