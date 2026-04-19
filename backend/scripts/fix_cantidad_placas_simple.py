#!/usr/bin/env python3
"""
Script para verificar y corregir la cantidad de placas en los lotes.
Se conecta a PostgreSQL directamente.
"""

import os
import math
from dotenv import load_dotenv

# Cargar variables de entorno
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://marmoles_user:marmoles_password@127.0.0.1:5432/marmoles_db")

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ psycopg2 no está instalado")
    print("Intenta instalar con: pip install psycopg2-binary")
    exit(1)

# Parsear la URL de conexión
try:
    # Formato: postgresql+psycopg2://user:password@host:port/database
    url_parts = DATABASE_URL.replace('postgresql+psycopg2://', '')
    user_pass, host_db = url_parts.split('@')
    user, password = user_pass.split(':')
    host_port, database = host_db.split('/')
    host, port = host_port.split(':')
    
    conn = psycopg2.connect(
        host=host,
        port=int(port),
        user=user,
        password=password,
        database=database
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)
except Exception as e:
    print(f"❌ Error al conectar a PostgreSQL: {e}")
    exit(1)

print(f"✓ Conectado a PostgreSQL: {database}\n")

try:
    # Obtener todos los lotes
    cursor.execute("""
        SELECT l.id, l.codigo_lote, l.material_id, l.ancho_m, l.largo_m, 
               l.stock_actual, l.cantidad, m.nombre as material_nombre
        FROM lotes l
        LEFT JOIN materiales m ON l.material_id = m.id
        ORDER BY l.codigo_lote
    """)
    
    lotes = cursor.fetchall()
    
    print(f"{'='*100}")
    print(f"REVISIÓN Y CORRECCIÓN DE CANTIDAD DE PLACAS")
    print(f"{'='*100}\n")
    
    cambios = []
    sin_cambios = []
    problemas = []
    
    for lote in lotes:
        cantidad_actual = lote['cantidad'] or 1
        
        # Validar datos
        if not lote['ancho_m'] or not lote['largo_m'] or lote['ancho_m'] <= 0 or lote['largo_m'] <= 0:
            problemas.append({
                'id': lote['id'],
                'codigo': lote['codigo_lote'],
                'material': lote['material_nombre'] or 'Desconocido',
                'problema': 'Dimensiones inválidas',
                'ancho': lote['ancho_m'],
                'largo': lote['largo_m'],
                'stock': lote['stock_actual'],
                'cantidad_actual': cantidad_actual
            })
            continue
        
        # Calcular cantidad correcta
        try:
            ancho = float(lote['ancho_m'])
            largo = float(lote['largo_m'])
            area_placa = ancho * largo
            stock_m2 = float(lote['stock_actual'])
            
            # Cantidad correcta = stock_total / area_por_placa, redondeado hacia arriba
            cantidad_correcta = int(math.ceil(stock_m2 / area_placa)) if area_placa > 0 else 1
            cantidad_correcta = max(1, cantidad_correcta)
            
            if cantidad_actual != cantidad_correcta:
                cambios.append({
                    'id': lote['id'],
                    'codigo': lote['codigo_lote'],
                    'material': lote['material_nombre'] or 'Desconocido',
                    'ancho': round(ancho, 2),
                    'largo': round(largo, 2),
                    'area_placa': round(area_placa, 3),
                    'stock_m2': stock_m2,
                    'cantidad_actual': cantidad_actual,
                    'cantidad_correcta': cantidad_correcta,
                })
            else:
                sin_cambios.append({
                    'codigo': lote['codigo_lote'],
                    'material': lote['material_nombre'] or 'Desconocido',
                    'cantidad': cantidad_actual,
                    'stock': stock_m2
                })
        except Exception as e:
            problemas.append({
                'id': lote['id'],
                'codigo': lote['codigo_lote'],
                'material': lote['material_nombre'] or 'Desconocido',
                'problema': f'Error al calcular: {str(e)}',
                'cantidad_actual': cantidad_actual
            })
    
    # Mostrar resumen
    print(f"✓ Lotes SIN CAMBIOS: {len(sin_cambios)}")
    print(f"⚠ Lotes QUE NECESITAN CORRECCIÓN: {len(cambios)}")
    print(f"✗ Lotes CON PROBLEMAS: {len(problemas)}")
    print(f"TOTAL: {len(lotes)} lotes\n")
    
    # Mostrar lotes con problemas
    if problemas:
        print(f"\n{'─'*100}")
        print("LOTES CON PROBLEMAS (no pueden corregirse automáticamente):")
        print(f"{'─'*100}")
        for p in problemas:
            print(f"  Lote: {p['codigo']} | Material: {p['material']}")
            print(f"    Problema: {p['problema']}")
            print(f"    Ancho: {p.get('ancho', 'N/D')} | Largo: {p.get('largo', 'N/D')} | Cantidad: {p['cantidad_actual']}")
            print()
    
    # Mostrar cambios que se harán
    if cambios:
        print(f"\n{'─'*100}")
        print("LOTES A CORREGIR:")
        print(f"{'─'*100}")
        print(f"{'Código Lote':<20} {'Material':<25} {'Dim (m)':<12} {'Stock m²':<10} {'Actual':<8} {'→ Correcto':<10}")
        print(f"{'-'*95}")
        
        for c in cambios:
            dim_str = f"{c['ancho']:.2f}×{c['largo']:.2f}"
            print(f"{c['codigo']:<20} {c['material']:<25} {dim_str:<12} {c['stock_m2']:<10.3f} {c['cantidad_actual']:<8} {c['cantidad_correcta']:<10}")
        
        print(f"\nAplicando correcciones...")
        
        # Aplicar cambios
        for c in cambios:
            cursor.execute(
                "UPDATE lotes SET cantidad = %s WHERE id = %s",
                (c['cantidad_correcta'], c['id'])
            )
        
        conn.commit()
        print(f"✓ {len(cambios)} lotes actualizados correctamente!\n")
    else:
        print(f"\n✓ Todos los lotes tienen la cantidad correcta!\n")
    
    # Mostrar algunos lotes verificados
    if sin_cambios and len(sin_cambios) <= 10:
        print(f"\n{'─'*100}")
        print("LOTES VERIFICADOS (sin cambios):")
        print(f"{'─'*100}")
        for s in sin_cambios[:10]:
            print(f"  {s['codigo']:<20} {s['material']:<25} Stock: {s['stock']:.3f}m² | Placas: {s['cantidad']}")
    
    print(f"\n{'='*100}")
    print("RESUMEN FINAL:")
    print(f"  • Lotes corregidos: {len(cambios)}")
    print(f"  • Lotes verificados (ok): {len(sin_cambios)}")
    print(f"  • Lotes con advertencias: {len(problemas)}")
    print(f"{'='*100}\n")

except Exception as e:
    print(f"❌ Error durante la ejecución: {e}")
    import traceback
    traceback.print_exc()

finally:
    conn.close()
