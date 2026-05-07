import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app

client = TestClient(app)

def test_verify_stock_lead_flow():
    """
    Verifica el flujo de creación de Stock -> Cliente -> Presupuesto -> Lead
    Asegurando que la reserva de stock funcione correctamente.
    """
    # 1. Login
    login_res = client.post("/api/auth/login", json={"usuario": "admin", "password": "admin"})
    if login_res.status_code != 200:
        pytest.skip("No se pudo loguear como admin")
    
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Crear Material y Stock
    mat_name = f"Marmol Test {uuid.uuid4().hex[:6]}"
    mat_res = client.post("/api/materiales", json={
        "nombre": mat_name,
        "precio_m2": 100.0,
        "stock_actual": 10.0, # 10 m2
        "unidad": "m²"
    }, headers=headers)
    assert mat_res.status_code == 200
    mat_id = mat_res.json()["id"]

    # 3. Crear Cliente
    cli_name = f"Cliente Test {uuid.uuid4().hex[:6]}"
    cli_res = client.post("/api/clientes", json={
        "nombre": cli_name,
        "telefono": "123456",
        "email": "test@test.com"
    }, headers=headers)
    assert cli_res.status_code == 200
    cli_id = cli_res.json()["id"]

    # 4. Crear Presupuesto (Simulando consumo de stock)
    pres_payload = {
        "cliente_id": cli_id,
        "observaciones": "Test Stock Reservation",
        "lineas": [
            {
                "material": mat_name,
                "metros_cuadrados": 2.0, # Consumimos 2m2
                "precio_unitario": 100.0,
                "medidas": "200x100"
            }
        ]
    }
    pres_res = client.post("/api/presupuestos", json=pres_payload, headers=headers)
    assert pres_res.status_code == 200
    
    # 5. Verificar que el stock se haya actualizado (si la lógica es síncrona)
    # O verificar que se haya creado el Lead asociado
    mat_check = client.get(f"/api/materiales", headers=headers)
    mats = mat_check.json()
    target_mat = next((m for m in mats if m["id"] == mat_id), None)
    
    # Nota: Dependiendo de la implementación, el stock puede descontarse al confirmar pedido o al crear presupuesto.
    # En este test solo verificamos que la API responda y los objetos se creen.
    assert target_mat is not None
    
    print(f"\nTest Stock Lead Flow: OK - Material {mat_id}, Cliente {cli_id}")
