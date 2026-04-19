from app.db import SessionLocal
from app.models import Cliente, Material, Lote, Placa, Retazo

def check_counts():
    db = SessionLocal()
    try:
        clients_count = db.query(Cliente).count()
        materials_count = db.query(Material).count()
        lotes_count = db.query(Lote).count()
        placas_count = db.query(Placa).count()
        retazos_count = db.query(Retazo).count()
        
        print(f"Clients: {clients_count}")
        print(f"Materials: {materials_count}")
        print(f"Lotes: {lotes_count}")
        print(f"Placas: {placas_count}")
        print(f"Retazos: {retazos_count}")
        
        if retazos_count > 0:
            retazos = db.query(Retazo).filter(Retazo.estado == "disponible").all()
            print(f"Available Retazos: {len(retazos)}")
            for r in retazos:
                m = db.query(Material).filter(Material.id == r.material_id).first()
                print(f" - Retazo ID: {r.id}, Material: {m.nombre if m else 'Unknown'} (ID: {r.material_id})")
        
        if clients_count > 0:
            c = db.query(Cliente).first()
            print(f"Sample Client: {c.nombre}, ID: {c.id}")
            
    finally:
        db.close()

if __name__ == "__main__":
    check_counts()
