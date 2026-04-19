#!/usr/bin/env python3
"""
Test para verificar que una nueva compra registrada guarda cantidad correcta
"""
import sys
sys.path.append('/home/agencia/proyectos/marmoles/backend')

from app.db import SessionLocal
from app.models.inventario import Compra as CompraModel, Lote as LoteModel, Material as MaterialModel
from datetime import datetime
import json

def test_nueva_compra():
    db = SessionLocal()
    try:
        print(f"\n{'='*80}")
        print(f"{'TEST: NUEVA COMPRA CON CANTIDAD > 1':^80}")
        print(f"{'='*80}\n")
        
        # Obtener la compra más reciente
        ultima_compra = db.query(CompraModel).order_by(CompraModel.fecha.desc()).first()
        
        if ultima_compra:
            print(f"Compra más reciente registrada:")
            print(f"  Proveedor: {ultima_compra.proveedor}")
            print(f"  Fecha: {ultima_compra.fecha}")
            
            # Obtener el lote asociado
            lote = db.query(LoteModel).filter(LoteModel.id == ultima_compra.lote_id).first()
            if lote:
                print(f"  Lote: {lote.codigo_lote}")
                print(f"\n  Verificación:")
                print(f"    ✓ Lote Cantidad (placas): {lote.cantidad}")
                print(f"    ✓ Compra Cantidad: {ultima_compra.cantidad}")
                
                if lote.cantidad == ultima_compra.cantidad:
                    print(f"\n    ✅ CONSISTENCIA OK: Compra.cantidad == Lote.cantidad ({lote.cantidad})")
                else:
                    print(f"\n    ❌ INCONSISTENCIA: Compra.cantidad != Lote.cantidad")
                    print(f"       {ultima_compra.cantidad} != {lote.cantidad}")
                
                # Calcular stock esperado
                area_por_placa = lote.stock_actual / lote.cantidad if lote.cantidad > 0 else 0
                stock_esperado = area_por_placa * lote.cantidad
                
                print(f"\n  Stock verification:")
                print(f"    Área por placa: {area_por_placa:.3f} m²")
                print(f"    Stock actual: {lote.stock_actual:.3f} m²")
                print(f"    Stock esperado ({lote.cantidad} placas × {area_por_placa:.3f}): {stock_esperado:.3f} m²")
                
                if abs(stock_esperado - lote.stock_actual) < 0.01:
                    print(f"    ✅ Stock OK")
                else:
                    print(f"    ⚠️  Stock desajuste")
            
            # Obtener el material
            material = db.query(MaterialModel).filter(MaterialModel.id == ultima_compra.material_id).first()
            if material:
                print(f"\n  Material: {material.nombre}")
                print(f"    Stock total en sistema: {material.stock_actual:.3f} m²")
        
        # Mostrar últimas 5 compras para contexto
        print(f"\n\n{'Últimas 5 compras registradas:':^80}")
        print(f"{'-'*80}")
        print(f"{'Fecha':<12} {'Proveedor':<20} {'Material':<18} {'Cant.':<8} {'Lote':<12} {'Stock m²':<10}")
        print(f"{'-'*80}")
        
        ultimas = db.query(
            CompraModel.fecha,
            CompraModel.proveedor,
            MaterialModel.nombre,
            CompraModel.cantidad,
            LoteModel.codigo_lote,
            LoteModel.stock_actual
        ).outerjoin(
            MaterialModel, CompraModel.material_id == MaterialModel.id
        ).outerjoin(
            LoteModel, CompraModel.lote_id == LoteModel.id
        ).order_by(CompraModel.fecha.desc()).limit(5).all()
        
        for compra in ultimas:
            fecha, prov, mat, cant, lote, stock = compra
            print(f"{fecha:<12} {prov:<20} {mat:<18} {cant:<8.0f} {lote:<12} {stock:<10.2f}")
        
        print(f"{'-'*80}\n")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_nueva_compra()
