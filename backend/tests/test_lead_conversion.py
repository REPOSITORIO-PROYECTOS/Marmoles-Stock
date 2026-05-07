import sys
import os
import uuid
from fastapi.testclient import TestClient
from app.db import SessionLocal
from app.models.crm import Lead, Cliente
from app.models.presupuestos import Presupuesto

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app

client = TestClient(app)
TEST_ID = str(uuid.uuid4())[:8]

def test_conversion_lead():
    print(f"\nTEST CONVERSION LEAD {TEST_ID}")
    
    # 1. Login (Mocked or real)
    response = client.post("/api/auth/login", json={"usuario": "admin", "password": "admin"})
    if response.status_code == 200:
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
    else:
        headers = {} # Fallback

    # 2. Crear Lead
    payload_lead = {
        "nombre": f"Lead Test {TEST_ID}",
        "email": f"lead_{TEST_ID}@test.com",
        "telefono": "555-0000",
        "estado": "nuevo"
    }
    res = client.post("/api/leads", json=payload_lead, headers=headers)
    assert res.status_code == 200
    lead_id = res.json()["id"]
    print(f"✓ Lead creado: {lead_id}")

    # 3. Convertir Lead
    payload_update = {"estado": "convertido"}
    res = client.patch(f"/api/leads/{lead_id}", json=payload_update, headers=headers)
    assert res.status_code == 200
    print(f"✓ Lead convertido")

    # 4. Verificar Cliente y Presupuesto
    db = SessionLocal()
    try:
        # Cliente
        cliente = db.query(Cliente).filter(Cliente.email == payload_lead["email"]).first()
        assert cliente is not None, "No se creó el cliente"
        print(f"✓ Cliente creado: {cliente.id}")

        # Presupuesto
        pres = db.query(Presupuesto).filter(Presupuesto.cliente_id == cliente.id).first()
        assert pres is not None, "No se creó el presupuesto"
        print(f"✓ Presupuesto creado: {pres.id}")
        assert pres.aceptado_venta == True, "El presupuesto debería estar aceptado"
        
        # Cleanup
        db.delete(pres)
        db.delete(cliente)
        db.query(Lead).filter(Lead.id == lead_id).delete()
        db.commit()
        print("✓ Cleanup realizado")
        
    finally:
        db.close()

if __name__ == "__main__":
    try:
        test_conversion_lead()
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
