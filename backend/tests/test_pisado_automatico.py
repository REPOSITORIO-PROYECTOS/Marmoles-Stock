import sys
import os
import uuid
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.db import SessionLocal
from app.models.inventario import Material, Placa, Retazo
from app.models import Trabajo, Acumulador, PiezaTrabajo

# Setup Client
client = TestClient(app)

# Test Data
TEST_ID = str(uuid.uuid4())[:8]
MATERIAL_NAME = f"Mármol Pisado {TEST_ID}"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

def log_step(step, message):
    print(f"\n[PASO {step}] {message}")

def test_pisado_automatico():
    print(f"\n{'='*50}")
    print(f"INICIO DE PRUEBA PISADO - ID: {TEST_ID}")
    print(f"{'='*50}")

    # Ensure Admin Exists & Reset Password
    db_setup = SessionLocal()
    from app.models.security import User
    from app.auth import hash_password
    
    admin_user = db_setup.query(User).filter(User.username == ADMIN_USER).first()
    if not admin_user:
        salt = os.urandom(16).hex()
        pwd = hash_password(ADMIN_PASS, salt)
        admin_user = User(username=ADMIN_USER, email="admin@test.com", password_hash=pwd, password_salt=salt, role="admin", active=True)
        db_setup.add(admin_user)
        db_setup.commit()
        print("Admin user created.")
    else:
        # Reset password to ensure test passes
        salt = os.urandom(16).hex()
        pwd = hash_password(ADMIN_PASS, salt)
        admin_user.password_hash = pwd
        admin_user.password_salt = salt
        db_setup.commit()
        print("Admin password reset.")
    db_setup.close()

    # 1. LOGIN
    response = client.post("/api/auth/login", json={"usuario": ADMIN_USER, "password": ADMIN_PASS})
    if response.status_code != 200:
        print(f"Login failed: {response.text}")
        return
        
    token = response.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    
    t1 = None
    t2 = None
    t3 = None
    acum_id = None
    mat = None
    placa = None
    retazo = None

    try:
        # 2. SETUP: Material, Placa, Retazo
        log_step(2, "Setup Inventario")
        
        # Material
        mat = Material(nombre=MATERIAL_NAME, precio_m2=100, espesor_mm=20, stock_actual=10)
        db.add(mat)
        db.commit()
        
        # Placa (300x200)
        placa = Placa(material_id=mat.id, ancho=300, largo=200, estado="disponible", codigo=f"PL-{TEST_ID}")
        db.add(placa)
        
        # Retazo (100x100)
        retazo = Retazo(material_id=mat.id, ancho=100, largo=100, estado="disponible")
        db.add(retazo)
        db.commit()
        
        print(f"Material {mat.id}, Placa {placa.id}, Retazo {retazo.id}")

        # 3. TEST RETAZO: Job fits in Retazo
        log_step(3, "Caso 1: Trabajo cabe en Retazo")
        
        t1 = Trabajo(cliente="Cliente Retazo", material_id=mat.id, visita_tecnica=True, aprobado_jefe=True, sena_abonada=True, medidas_corregidas=True)
        db.add(t1)
        db.flush()
        db.add(PiezaTrabajo(trabajo_id=t1.id, w=50, h=50, qty=1))
        db.commit()
        
        # Call Logic
        res = client.post(f"/api/produccion/ingreso-automatico/{t1.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        print("Response:", data)
        assert data["status"] == "asignado_retazo"
        assert data["retazo_id"] == retazo.id

        # 4. TEST ACUMULADOR NEW: Job needs Plate
        log_step(4, "Caso 2: Trabajo necesita Placa (Nuevo Acumulador)")
        
        t2 = Trabajo(
            cliente="Cliente Placa 1", 
            material_id=mat.id, 
            visita_tecnica=True, aprobado_jefe=True, sena_abonada=True, medidas_corregidas=True,
            fecha_entrega_programada=(datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        )
        db.add(t2)
        db.flush()
        db.add(PiezaTrabajo(trabajo_id=t2.id, w=200, h=150, qty=1)) # Too big for retazo 100x100
        db.commit()
        
        res = client.post(f"/api/produccion/ingreso-automatico/{t2.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        print("Response:", data)
        assert data["status"] == "nuevo_acumulador"
        acum_id = data["acumulador_id"]
        
        # Verify DB State
        acum = db.query(Acumulador).filter(Acumulador.id == acum_id).first()
        assert acum is not None
        assert acum.placa_reservada_id == placa.id
        
        p = db.query(Placa).filter(Placa.id == placa.id).first()
        assert p.reservado_por == acum_id

        # 5. TEST ACUMULADOR JOIN: Job joins existing
        log_step(5, "Caso 3: Trabajo se une a Acumulador")
        
        t3 = Trabajo(
            cliente="Cliente Placa 2", 
            material_id=mat.id, 
            visita_tecnica=True, aprobado_jefe=True, sena_abonada=True, medidas_corregidas=True
        )
        db.add(t3)
        db.flush()
        db.add(PiezaTrabajo(trabajo_id=t3.id, w=50, h=50, qty=1))
        db.commit()
        
        res = client.post(f"/api/produccion/ingreso-automatico/{t3.id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        print("Response:", data)
        assert data["status"] == "agregado_acumulador"
        assert data["acumulador_id"] == acum_id
        
        # Verify counts
        db.refresh(acum)
        ids = json.loads(acum.trabajos_ids)
        assert len(ids) == 2 # t2 and t3

        # 6. TEST DEADLINE
        log_step(6, "Caso 4: Verificar Deadline")
        
        # Force deadline to yesterday
        acum.deadline = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        db.commit()
        
        res = client.post("/api/produccion/acumuladores/verificar-deadlines", headers=headers)
        assert res.status_code == 200
        data = res.json()
        print("Response:", data)
        assert acum_id in data["acumuladores_disparados"]
        
        db.refresh(acum)
        assert acum.estado == "procesado_por_deadline"
        
        print("\n✅ PRUEBA EXITOSA")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        log_step(99, "Cleanup")
        
        if acum_id:
            db.query(Acumulador).filter(Acumulador.id == acum_id).delete()
        
        ids_to_del = []
        if t1: ids_to_del.append(t1.id)
        if t2: ids_to_del.append(t2.id)
        if t3: ids_to_del.append(t3.id)
        
        if ids_to_del:
            db.query(PiezaTrabajo).filter(PiezaTrabajo.trabajo_id.in_(ids_to_del)).delete()
            db.query(Trabajo).filter(Trabajo.id.in_(ids_to_del)).delete()
        
        if retazo: db.query(Retazo).filter(Retazo.id == retazo.id).delete()
        if placa: db.query(Placa).filter(Placa.id == placa.id).delete()
        if mat: db.query(Material).filter(Material.id == mat.id).delete()
        
        db.commit()
        db.close()

if __name__ == "__main__":
    test_pisado_automatico()
