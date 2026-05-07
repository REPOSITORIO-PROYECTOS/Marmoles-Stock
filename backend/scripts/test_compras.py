#!/usr/bin/env python3
"""
Script para verificar cómo se están guardando los datos de compras.
Revisa cantidad, número de lote y otros campos críticos.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime, timedelta

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
    cursor = conn.cursor(cursor_factory=RealDictCursor)
except Exception as e:
    print(f"❌ Error al conectar: {e}")
    exit(1)

print(f"✓ Conectado a {database}\n")

try:
    print(f"{'='*120}")
    print(f"TEST DE DATOS DE COMPRAS")
    print(f"{'='*120}\n")

    # TEST 1: Últimas 10 compras
    print(f"{'─'*120}")
    print("1. ÚLTIMAS 10 COMPRAS REGISTRADAS:")
    print(f"{'─'*120}\n")

    cursor.execute("""
        SELECT 
            c.id,
            c.fecha,
            c.proveedor,
            m.nombre as material,
            c.cantidad as cantidad_compra,
            c.monto,
            c.lote_id,
            l.codigo_lote,
            l.cantidad as cantidad_lote,
            l.stock_actual,
            l.ancho_m,
            l.largo_m
        FROM compras c
        LEFT JOIN materiales m ON c.material_id = m.id
        LEFT JOIN lotes l ON c.lote_id = l.id
        ORDER BY c.fecha DESC NULLS LAST, c.id DESC
        LIMIT 10
    """)

    compras = cursor.fetchall()
    
    if compras:
        print(f"{'Fecha':<12} {'Proveedor':<20} {'Material':<20} {'Cant.Compra':<12} {'Lote':<15} {'Cant.Lote':<12} {'Stock m²':<12}")
        print(f"{'-'*120}")
        
        for c in compras:
            fecha = c['fecha'][:10] if c['fecha'] else 'N/A'
            proveedor = c['proveedor'][:19] if c['proveedor'] else 'N/A'
            material = c['material'][:19] if c['material'] else 'N/A'
            cantidad_compra = c['cantidad_compra'] if c['cantidad_compra'] is not None else 'NULL'
            lote = c['codigo_lote'][:14] if c['codigo_lote'] else 'SIN_ID'
            cantidad_lote = c['cantidad_lote'] if c['cantidad_lote'] is not None else 'NULL'
            stock_m2 = f"{c['stock_actual']:.2f}" if c['stock_actual'] else '0.00'
            
            print(f"{fecha:<12} {proveedor:<20} {material:<20} {str(cantidad_compra):<12} {lote:<15} {str(cantidad_lote):<12} {stock_m2:<12}")
        
        print()
    else:
        print("⚠️  No hay compras registradas\n")

    # TEST 2: Detalle de una compra reciente
    print(f"\n{'─'*120}")
    print("2. DETALLE COMPLETO DE LA COMPRA MÁS RECIENTE:")
    print(f"{'─'*120}\n")

    cursor.execute("""
        SELECT 
            c.id,
            c.fecha,
            c.proveedor,
            c.material_id,
            m.nombre as material,
            c.cantidad as cantidad_compra,
            c.monto,
            c.lote_id,
            l.codigo_lote,
            l.cantidad as cantidad_lote,
            l.cantidad_inicial,
            l.stock_actual,
            l.costo_m2,
            l.precio_venta,
            l.precio_mayorista,
            l.ancho_m,
            l.largo_m,
            l.ubicacion,
            l.fecha_ingreso,
            p.nombre as proveedor_nombre
        FROM compras c
        LEFT JOIN materiales m ON c.material_id = m.id
        LEFT JOIN lotes l ON c.lote_id = l.id
        LEFT JOIN proveedores p ON l.proveedor_id = p.id
        ORDER BY c.fecha DESC NULLS LAST, c.id DESC
        LIMIT 1
    """)

    compra_reciente = cursor.fetchone()
    
    if compra_reciente:
        print(f"ID Compra:              {compra_reciente['id']}")
        print(f"Fecha:                  {compra_reciente['fecha'] or 'N/A'}")
        print(f"Proveedor:              {compra_reciente['proveedor']}")
        print(f"\n📦 DATOS DE COMPRA:")
        print(f"  Material:             {compra_reciente['material']}")
        print(f"  Cantidad comprada:    {compra_reciente['cantidad_compra']} ← ⚠️  REVISAR")
        print(f"  Monto:                ${compra_reciente['monto']:,.2f}")
        print(f"\n📋 DATOS DEL LOTE ASOCIADO:")
        print(f"  ID Lote:              {compra_reciente['lote_id']}")
        print(f"  Código Lote:          {compra_reciente['codigo_lote']} ← ⚠️  REVISAR")
        print(f"  Cantidad placas:      {compra_reciente['cantidad_lote']} ← ⚠️  REVISAR")
        print(f"  Stock m²:             {compra_reciente['stock_actual']:.3f}")
        print(f"  Stock inicial:        {compra_reciente['cantidad_inicial']:.3f}")
        print(f"  Dimensiones:          {compra_reciente['ancho_m']:.2f}m × {compra_reciente['largo_m']:.2f}m" if compra_reciente['ancho_m'] and compra_reciente['largo_m'] else "  Dimensiones:          N/A")
        area_unitaria = (compra_reciente['ancho_m'] * compra_reciente['largo_m']) if compra_reciente['ancho_m'] and compra_reciente['largo_m'] else None
        if area_unitaria:
            print(f"  Área por placa:       {area_unitaria:.3f} m²")
        print(f"  Ubicación:            {compra_reciente['ubicacion'] or 'Sin ubicación'}")
        print(f"  Costo m²:             ${compra_reciente['costo_m2']:,.2f}")
        print(f"  Precio público:       ${compra_reciente['precio_venta']:,.2f}" if compra_reciente['precio_venta'] else f"  Precio público:       N/A")
        print(f"  Precio mayorista:     ${compra_reciente['precio_mayorista']:,.2f}" if compra_reciente['precio_mayorista'] else f"  Precio mayorista:     N/A")
        print()
    else:
        print("⚠️  No hay compras registradas\n")

    # TEST 3: Verificar inconsistencias
    print(f"\n{'─'*120}")
    print("3. VERIFICACIÓN DE INCONSISTENCIAS:")
    print(f"{'─'*120}\n")

    cursor.execute("""
        SELECT 
            c.id,
            c.cantidad as cantidad_compra,
            l.cantidad as cantidad_lote,
            l.stock_actual,
            l.ancho_m,
            l.largo_m,
            c.proveedor,
            c.fecha
        FROM compras c
        LEFT JOIN lotes l ON c.lote_id = l.id
        ORDER BY c.fecha DESC NULLS LAST
        LIMIT 20
    """)

    issues = []
    todas_compras = cursor.fetchall()
    
    for row in todas_compras:
        problemas = []
        
        # Cantidad NULL
        if row['cantidad_compra'] is None:
            problemas.append("cantidad_compra es NULL")
        
        # Lote sin asignar
        if row['cantidad_lote'] is None:
            problemas.append("No hay lote asociado")
        
        # Inconsistencia cantidad vs stock
        if row['cantidad_lote'] is not None and row['ancho_m'] and row['largo_m']:
            area_unitaria = row['ancho_m'] * row['largo_m']
            stock_esperado = row['cantidad_lote'] * area_unitaria
            if abs(stock_esperado - (row['stock_actual'] or 0)) > 0.01:
                problemas.append(f"Stock inconsistente: esperado {stock_esperado:.2f}m², tiene {row['stock_actual']:.2f}m²")
        
        if problemas:
            issues.append({
                'fecha': row['fecha'],
                'proveedor': row['proveedor'],
                'cantidad_compra': row['cantidad_compra'],
                'cantidad_lote': row['cantidad_lote'],
                'problemas': problemas
            })
    
    if issues:
        print(f"⚠️  Se encontraron {len(issues)} problemas:\n")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue['fecha'][:10]} | {issue['proveedor'][:30]}")
            print(f"     Cantidad compra: {issue['cantidad_compra']}, Cantidad lote: {issue['cantidad_lote']}")
            for problema in issue['problemas']:
                print(f"     ❌ {problema}")
            print()
    else:
        print("✓ No se encontraron inconsistencias\n")

    # TEST 4: Estadísticas
    print(f"\n{'─'*120}")
    print("4. ESTADÍSTICAS:")
    print(f"{'─'*120}\n")

    cursor.execute("""
        SELECT 
            COUNT(*) as total_compras,
            SUM(CASE WHEN cantidad IS NULL THEN 1 ELSE 0 END) as sin_cantidad,
            SUM(CASE WHEN lote_id IS NULL THEN 1 ELSE 0 END) as sin_lote,
            SUM(CASE WHEN fecha IS NULL THEN 1 ELSE 0 END) as sin_fecha
        FROM compras
    """)

    stats = cursor.fetchone()
    print(f"Total de compras:       {stats['total_compras']}")
    print(f"Sin cantidad:           {stats['sin_cantidad']} ❌" if stats['sin_cantidad'] > 0 else f"Sin cantidad:           0 ✓")
    print(f"Sin lote asignado:      {stats['sin_lote']} ❌" if stats['sin_lote'] > 0 else f"Sin lote asignado:      0 ✓")
    print(f"Sin fecha:              {stats['sin_fecha']} ❌" if stats['sin_fecha'] > 0 else f"Sin fecha:              0 ✓")

    print(f"\n{'='*120}")
    print("FIN DEL TEST")
    print(f"{'='*120}\n")

except Exception as e:
    print(f"❌ Error durante el test: {e}")
    import traceback
    traceback.print_exc()

finally:
    conn.close()
