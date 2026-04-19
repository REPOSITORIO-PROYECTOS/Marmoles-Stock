"""
Script para asignar placas y retazos a lotes, y eliminar lotes huérfanos.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.models.inventario import Material, Lote, Placa, Retazo

def main():
    db = SessionLocal()
    
    try:
        print('\n' + '='*60)
        print('LIMPIEZA DE LOTES HUÉRFANOS')
        print('='*60)
        
        # Paso 1: Asignar placas sin lote_id a un lote existente del mismo material
        print('\n[1] ASIGNANDO PLACAS A LOTES...')
        placas_sin_lote = db.query(Placa).filter(Placa.lote_id == None).all()
        placas_asignadas = 0
        
        for placa in placas_sin_lote:
            # Buscar un lote del mismo material
            lote = db.query(Lote).filter(Lote.material_id == placa.material_id).first()
            
            if lote:
                mat = db.query(Material).filter(Material.id == placa.material_id).first()
                print(f'  ✓ Placa {placa.id[:12]}... ({mat.nombre if mat else "???"}) → Lote {lote.codigo_lote}')
                placa.lote_id = lote.id
                placas_asignadas += 1
            else:
                mat = db.query(Material).filter(Material.id == placa.material_id).first()
                print(f'  ⚠ Placa {placa.id[:12]}... ({mat.nombre if mat else "???"}) - No hay lote disponible')
        
        db.commit()
        print(f'\n  → {placas_asignadas} placas asignadas a lotes')
        
        # Paso 2: Asignar retazos sin lote_id a un lote existente del mismo material
        print('\n[2] ASIGNANDO RETAZOS A LOTES...')
        retazos_sin_lote = db.query(Retazo).filter(Retazo.lote_id == None).all()
        retazos_asignados = 0
        
        for retazo in retazos_sin_lote:
            # Buscar un lote del mismo material
            lote = db.query(Lote).filter(Lote.material_id == retazo.material_id).first()
            
            if lote:
                mat = db.query(Material).filter(Material.id == retazo.material_id).first()
                print(f'  ✓ Retazo {retazo.id[:12]}... ({mat.nombre if mat else "???"}) → Lote {lote.codigo_lote}')
                retazo.lote_id = lote.id
                retazos_asignados += 1
            else:
                mat = db.query(Material).filter(Material.id == retazo.material_id).first()
                print(f'  ⚠ Retazo {retazo.id[:12]}... ({mat.nombre if mat else "???"}) - No hay lote disponible')
        
        db.commit()
        print(f'\n  → {retazos_asignados} retazos asignados a lotes')
        
        # Paso 3: Identificar lotes sin placas ni retazos
        print('\n[3] IDENTIFICANDO LOTES HUÉRFANOS...')
        todos_lotes = db.query(Lote).all()
        lotes_huerfanos = []
        
        for lote in todos_lotes:
            placas_count = db.query(Placa).filter(Placa.lote_id == lote.id).count()
            retazos_count = db.query(Retazo).filter(Retazo.lote_id == lote.id).count()
            
            if placas_count == 0 and retazos_count == 0:
                mat = db.query(Material).filter(Material.id == lote.material_id).first()
                lotes_huerfanos.append({
                    'obj': lote,
                    'codigo': lote.codigo_lote,
                    'material': mat.nombre if mat else '???',
                    'stock': lote.stock_actual,
                    'cantidad': lote.cantidad
                })
                
        print(f'  → {len(lotes_huerfanos)} lotes sin placas ni retazos')
        for l in lotes_huerfanos:
            print(f'    - {l["codigo"]} | Material: {l["material"]} | Stock: {l["stock"]}')
        
        # Paso 4: Eliminar lotes huérfanos
        if lotes_huerfanos:
            print('\n[4] ELIMINANDO LOTES HUÉRFANOS...')
            respuesta = input(f'  ¿Deseas eliminar estos {len(lotes_huerfanos)} lotes? (s/n): ')
            
            if respuesta.lower() == 's':
                for item in lotes_huerfanos:
                    lote = item['obj']
                    print(f'  ✗ Eliminando {lote.codigo_lote} ({item["material"]})')
                    db.delete(lote)
                
                db.commit()
                print(f'\n  → {len(lotes_huerfanos)} lotes eliminados')
            else:
                print('  → Operación cancelada')
        else:
            print('\n[4] No hay lotes huérfanos para eliminar ✓')
        
        print('\n' + '='*60)
        print('LIMPIEZA COMPLETADA')
        print('='*60 + '\n')
        
    except Exception as e:
        print(f'\n❌ Error: {e}')
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == '__main__':
    main()
