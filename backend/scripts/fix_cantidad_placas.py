#!/usr/bin/env python3
"""
Script para verificar y corregir la cantidad de placas en los lotes.
Calcula la cantidad correcta basada en superficie / área de cada placa.
"""

import sys
import os
import math
from datetime import datetime

# Agregar el backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models import Lote as LoteModel, Material as MaterialModel
from app.db import get_db, DATABASE_URL

# Crear conexión a la BD
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def calcular_cantidad_correcta(lote: LoteModel) -> int:
    """Calcula la cantidad correcta de placas basada en stock_actual / área"""
    if not lote.stock_actual or not lote.ancho_m or not lote.largo_m:
        return lote.cantidad  # Retornar la cantidad actual si no hay datos
    
    try:
        ancho = float(lote.ancho_m)
        largo = float(lote.largo_m)
        
        if ancho <= 0 or largo <= 0:
            return lote.cantidad
        
        area_placa = ancho * largo
        stock_m2 = float(lote.stock_actual)
        
        # Cantidad = stock_total / area_por_placa, redondeado hacia arriba
        cantidad_correcta = int(math.ceil(stock_m2 / area_placa))
        return max(1, cantidad_correcta)  # Mínimo 1 placa
    except Exception as e:
        print(f"Error calculando cantidad para lote {lote.id}: {e}")
        return lote.cantidad

def main():
    db: Session = SessionLocal()
    
    try:
        # Obtener todos los lotes orden
        lotes = db.query(LoteModel).filter(LoteModel.activo == True).all()
        
        print(f"\n{'='*100}")
        print(f"REVISIÓN Y CORRECCIÓN DE CANTIDAD DE PLACAS")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*100}\n")
        
        cambios = []
        sin_cambios = []
        problemas = []
        
        for lote in lotes:
            cantidad_correcta = calcular_cantidad_correcta(lote)
            cantidad_actual = lote.cantidad or 1
            
            # Construir info del lote
            mat = db.query(MaterialModel).filter(MaterialModel.id == lote.material_id).first()
            material_nombre = mat.nombre if mat else "Desconocido"
            area_placa = (float(lote.ancho_m) * float(lote.largo_m)) if (lote.ancho_m and lote.largo_m) else 0
            
            info = {
                'lote_id': lote.id,
                'codigo': lote.codigo_lote,
                'material': material_nombre,
                'ancho': lote.ancho_m,
                'largo': lote.largo_m,
                'area_placa': round(area_placa, 3) if area_placa else 0,
                'stock_m2': lote.stock_actual,
                'cantidad_actual': cantidad_actual,
                'cantidad_correcta': cantidad_correcta,
            }
            
            # Validar datos
            if not lote.ancho_m or not lote.largo_m or lote.ancho_m <= 0 or lote.largo_m <= 0:
                problemas.append({**info, 'problema': 'Dimensiones inválidas'})
            elif cantidad_actual != cantidad_correcta:
                cambios.append(info)
            else:
                sin_cambios.append(info)
        
        # Mostrar resumen
        print(f"✓ Lotes SIN CAMBIOS: {len(sin_cambios)}")
        print(f"⚠ Lotes QUE NECESITAN CORRECCIÓN: {len(cambios)}")
        print(f"✗ Lotes CON PROBLEMAS: {len(problemas)}")
        print(f"TOTAL: {len(lotes)} lotes\n")
        
        # Mostrar lotes con problemas si los hay
        if problemas:
            print(f"\n{'─'*100}")
            print("LOTES CON PROBLEMAS (no pueden corregirse automáticamente):")
            print(f"{'─'*100}")
            for p in problemas:
                print(f"  Lote: {p['codigo']} | Material: {p['material']}")
                print(f"    Problema: {p['problema']}")
                print(f"    Stock m²: {p['stock_m2']} | Cantidad: {p['cantidad_actual']}")
                print()
        
        # Mostrar cambios que se harán
        if cambios:
            print(f"\n{'─'*100}")
            print("LOTES A CORREGIR:")
            print(f"{'─'*100}")
            print(f"{'Código Lote':<20} {'Material':<25} {'Dim (m)':<12} {'Stock m²':<10} {'Actual':<8} {'→ Correcto':<10}")
            print(f"{'-'*95}")
            
            for c in cambios:
                dim_str = f"{c['ancho']:.2f}×{c['largo']:.2f}" if c['ancho'] and c['largo'] else "N/D"
                print(f"{c['codigo']:<20} {c['material']:<25} {dim_str:<12} {c['stock_m2']:<10.3f} {c['cantidad_actual']:<8} {c['cantidad_correcta']:<10}")
            
            print(f"\nProcediendo con correcciones...")
            
            # Aplicar cambios
            for c in cambios:
                lote = db.query(LoteModel).filter(LoteModel.id == c['lote_id']).first()
                if lote:
                    lote.cantidad = c['cantidad_correcta']
                    db.add(lote)
            
            db.commit()
            print(f"✓ {len(cambios)} lotes actualizados correctamente!\n")
        else:
            print(f"\n✓ Todos los lotes tienen la cantidad correcta!\n")
        
        # Mostrar lotes sin cambios (muestra para verificar)
        if sin_cambios and len(sin_cambios) <= 10:
            print(f"\n{'─'*100}")
            print("LOTES VERIFICADOS (sin cambios):")
            print(f"{'─'*100}")
            for s in sin_cambios[:10]:
                dim_str = f"{s['ancho']:.2f}×{s['largo']:.2f}" if s['ancho'] and s['largo'] else "N/D"
                print(f"  {s['codigo']:<20} {s['material']:<25} {dim_str:<12} Stock: {s['stock_m2']:.3f}m² | Placas: {s['cantidad_actual']}")
        
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
        db.close()

if __name__ == "__main__":
    main()
