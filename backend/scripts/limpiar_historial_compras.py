#!/usr/bin/env python3
"""
Script para eliminar registros de prueba del historial de compras.
"""

import os
import psycopg2
from dotenv import load_dotenv

# Cargar variables de entorno
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://marmoles_user:marmoles_password@127.0.0.1:5432/marmoles_db")

# Parsear URL
url_parts = DATABASE_URL.replace('postgresql+psycopg2://', '')
user_pass, host_db = url_parts.split('@')
user, password = user_pass.split(':')
host_port, database = host_db.split('/')
host, port = host_port.split(':')

try:
    conn = psycopg2.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database
    )
    cursor = conn.cursor()
except Exception as e:
    print(f"❌ Error al conectar: {e}")
    exit(1)

print(f"✓ Conectado a {database}\n")

try:
    # Buscar registros de prueba por proveedor
    proveedores_prueba = [
        'qw',
        'Proveedor de Prueba',
        'Juancito',
        'Simon',
        'javier',
        'test',
        'Test'
    ]
    
    print(f"{'='*80}")
    print("BÚSQUEDA DE REGISTROS DE PRUEBA")
    print(f"{'='*80}\n")
    
    # Buscar por proveedor
    cursor.execute("SELECT COUNT(*) FROM compras WHERE proveedor IN %s", (tuple(proveedores_prueba),))
    total_por_proveedor = cursor.fetchone()[0]
    
    # Buscar lotes con nombres sospechosos
    cursor.execute("""
        SELECT COUNT(*) FROM compras 
        WHERE lote_id IN (
            SELECT id FROM lotes 
            WHERE codigo_lote IN ('VetaFina12', 'L-202602160325', 'Lote1', 'LOT121', 'daw', 'A2daw')
        )
    """)
    total_por_lote = cursor.fetchone()[0]
    
    print(f"Registros por proveedor de prueba: {total_por_proveedor}")
    print(f"Registros por lote de prueba: {total_por_lote}")
    print(f"TOTAL PARA ELIMINAR: {total_por_proveedor + total_por_lote}\n")
    
    # Mostrar detalles
    cursor.execute("""
        SELECT id, fecha, proveedor, monto FROM compras 
        WHERE proveedor IN %s
        ORDER BY fecha DESC
    """, (tuple(proveedores_prueba),))
    
    registros = cursor.fetchall()
    
    if registros:
        print(f"{'─'*80}")
        print("REGISTROS A ELIMINAR (por proveedor):")
        print(f"{'─'*80}")
        for reg in registros:
            print(f"  {reg[1]} | {reg[2]:<25} | ${reg[3]:>12.2f}")
    
    print(f"\n{'─'*80}")
    print("¿Deseas eliminar estos registros? (sí/no)")
    respuesta = input("> ").strip().lower()
    
    if respuesta in ['sí', 'si', 's', 'yes', 'y']:
        # Eliminar por proveedor
        cursor.execute(
            "DELETE FROM compras WHERE proveedor IN %s",
            (tuple(proveedores_prueba),)
        )
        deleted_count = cursor.rowcount
        
        # Eliminar por lote
        cursor.execute("""
            DELETE FROM compras 
            WHERE lote_id IN (
                SELECT id FROM lotes 
                WHERE codigo_lote IN (%s, %s, %s, %s, %s, %s)
            )
        """, ('VetaFina12', 'L-202602160325', 'Lote1', 'LOT121', 'daw', 'A2daw'))
        deleted_count += cursor.rowcount
        
        conn.commit()
        print(f"\n✓ {deleted_count} registros eliminados correctamente!")
        
        # Mostrar confirmación
        cursor.execute("SELECT COUNT(*) FROM compras")
        total_restante = cursor.fetchone()[0]
        print(f"✓ Registros restantes en compras: {total_restante}")
    else:
        print("❌ Operación cancelada")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    conn.close()
    print()
