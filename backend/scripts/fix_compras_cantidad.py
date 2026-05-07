#!/usr/bin/env python3
"""
Fix cantidad in compras table to match lote cantidad
"""
import sys
sys.path.append('/home/agencia/proyectos/marmoles/backend')

from app.db import SessionLocal, engine
from app.models.inventario import Compra as CompraModel, Lote as LoteModel, Material as MaterialModel
from sqlalchemy.orm import Session
from sqlalchemy import func

def fix_compras():
    db = SessionLocal()
    try:
        # Get all compras with lote_id
        compras = db.query(CompraModel).filter(CompraModel.lote_id.isnot(None)).all()
        
        print(f"\n{'='*80}")
        print(f"{'CORRIGIENDO CANTIDADES EN COMPRAS':^80}")
        print(f"{'='*80}\n")
        
        actualizado = 0
        errores = []
        
        for compra in compras:
            lote = db.query(LoteModel).filter(LoteModel.id == compra.lote_id).first()
            
            if not lote:
                errores.append(f"Compra {compra.id}: Lote no encontrado {compra.lote_id}")
                continue
            
            # Si la cantidad de la compra no coincide con la del lote, actualizar
            if compra.cantidad != lote.cantidad:
                print(f"Corrigiendo compra {compra.id}")
                print(f"  {compra.proveedor} - {lote.codigo_lote}")
                print(f"  Cantidad anterior: {compra.cantidad} → Nueva: {lote.cantidad}")
                print(f"  Material: {lote.material_id}")
                
                # Actualizar cantidad
                compra.cantidad = lote.cantidad
                actualizado += 1
                print()
        
        if actualizado > 0:
            db.commit()
            print(f"✓ {actualizado} compra(s) actualizada(s)\n")
        else:
            print("✓ Todas las compras ya tienen la cantidad correcta\n")
        
        if errores:
            print(f"⚠️ {len(errores)} error(es):")
            for error in errores:
                print(f"  - {error}")
        
        # Mostrar resumen de compras después de la corrección
        print(f"\nRESUMEN DE COMPRAS POS-CORRECCIÓN:")
        print(f"{'-'*80}")
        compras_resumen = db.query(
            CompraModel.id,
            CompraModel.proveedor,
            MaterialModel.nombre,
            CompraModel.cantidad,
            func.coalesce(LoteModel.codigo_lote, 'SIN LOTE'),
            func.coalesce(LoteModel.cantidad, 0)
        ).outerjoin(
            MaterialModel, CompraModel.material_id == MaterialModel.id
        ).outerjoin(
            LoteModel, CompraModel.lote_id == LoteModel.id
        ).order_by(CompraModel.fecha.desc()).limit(15).all()
        
        print(f"{'Fecha':<12} {'Proveedor':<20} {'Material':<20} {'Cant.Compra':<12} {'Lote':<12} {'Cant.Lote':<12}")
        print(f"{'-'*80}")
        for compra in compras_resumen:
            comp_id, proveedor, material, cant_compra, lote, cant_lote = compra
            print(f"  {proveedor:<18} {material:<18} {cant_compra:<10} {lote:<10} {cant_lote:<10}")
        
        print(f"{'-'*80}\n")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_compras()
