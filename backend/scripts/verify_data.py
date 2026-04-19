import os
import sys
from sqlalchemy import text

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.db import SessionLocal

def verify():
    db = SessionLocal()
    try:
        tables = [
            "users", "clientes", "proveedores", "materiales", 
            "lotes", "placas", "inventario_movimientos",
            "leads", "oportunidades", "presupuestos", 
            "planos_tecnicos", "trabajos", "pagos"
        ]
        
        print("--- Database Counts ---")
        total_items = 0
        for table in tables:
            try:
                count = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"{table.ljust(20)}: {count}")
                total_items += count
            except Exception as e:
                print(f"{table.ljust(20)}: Error - {e}")
        
        if total_items > 0:
            print("\nSUCCESS: Database is populated.")
        else:
            print("\nWARNING: Database seems empty.")
            
    finally:
        db.close()

if __name__ == "__main__":
    verify()
