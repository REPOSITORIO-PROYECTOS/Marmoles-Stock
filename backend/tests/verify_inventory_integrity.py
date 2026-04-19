import os
import sys
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.db import SessionLocal
from app.models import Material, Lote, Placa, PlanoTecnico

def run_integrity_check():
    db = SessionLocal()
    try:
        print("Starting Inventory Integrity Check...")
        errors = []

        # 1. Check Lote -> Material integrity
        lotes = db.query(Lote).all()
        for lote in lotes:
            if not lote.material_id:
                errors.append(f"Lote {lote.codigo_lote} ({lote.id}) has no material_id")
            else:
                mat = db.query(Material).get(lote.material_id)
                if not mat:
                    errors.append(f"Lote {lote.codigo_lote} references non-existent material {lote.material_id}")

        # 2. Check Placa -> Lote integrity
        placas = db.query(Placa).all()
        for placa in placas:
            if not placa.lote_id:
                errors.append(f"Placa {placa.codigo} ({placa.id}) has no lote_id")
            else:
                lote = db.query(Lote).get(placa.lote_id)
                if not lote:
                    errors.append(f"Placa {placa.codigo} references non-existent lote {placa.lote_id}")

        # 3. Check Placa Reservation Status
        reserved_placas = db.query(Placa).filter(Placa.plano_tecnico_id != None).all()
        for placa in reserved_placas:
            if placa.estado == "disponible":
                errors.append(f"Placa {placa.codigo} is linked to Plano {placa.plano_tecnico_id} but status is 'disponible'")
            
            # Verify Plano exists
            plano = db.query(PlanoTecnico).get(placa.plano_tecnico_id)
            if not plano:
                 errors.append(f"Placa {placa.codigo} references non-existent plano {placa.plano_tecnico_id}")

        # 4. Check Stock Consistency (Optional but good)
        materials = db.query(Material).all()
        for mat in materials:
            lotes_stock = sum(l.stock_actual for l in db.query(Lote).filter(Lote.material_id == mat.id).all())
            # Allow small floating point differences
            if abs(mat.stock_actual - lotes_stock) > 0.01:
                # This might not be an error if Material.stock_actual includes loose stock not in batches, 
                # but for this system strictness, let's warn.
                print(f"WARNING: Material {mat.nombre} stock ({mat.stock_actual}) != Sum of Lotes ({lotes_stock})")

        if errors:
            print("\nERRORS FOUND:")
            for e in errors:
                print(f" - {e}")
            sys.exit(1)
        else:
            print("\nSUCCESS: Inventory Integrity Verified. No errors found.")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_integrity_check()
