import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.db import SessionLocal
from app.models.inventario import Material
from app.models.produccion import Trabajo
from app.models.crm import Cliente
from app.models.presupuestos import Presupuesto

# Setup Client
client = TestClient(app)

# Test Data
TEST_ID = str(uuid.uuid4())[:8]
MATERIAL_NAME = f"Mármol E2E {TEST_ID}"
CLIENT_NAME = f"Cliente E2E {TEST_ID}"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

def log_step(step, message):
    print(f"\n[PASO {step}] {message}")

def test_e2e_full_process():
    print(f"\n{'='*50}")
    print(f"INICIO DE PRUEBA E2E - ID: {TEST_ID}")
    print(f"{'='*50}")

    # 1. LOGIN
    log_step(1, "Autenticación de Administrador")
    response = client.post("/api/auth/login", json={"usuario": ADMIN_USER, "password": ADMIN_PASS})
    assert response.status_code == 200, "Fallo en login"
    token = response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Login exitoso. Token obtenido.")

    # 2. INVENTARIO: Crear Material
    log_step(2, f"Creación de Material: {MATERIAL_NAME}")
    payload_mat = {
        "nombre": MATERIAL_NAME,
        "precio_m2": 150.0,
        "espesor_mm": 20,
        "color": "Blanco Test",
        "stock_actual": 100,
        "unidad": "m²"
    }
    response = client.post("/api/materiales", json=payload_mat, headers=headers)
    assert response.status_code == 200, f"Fallo al crear material: {response.text}"
    material_id = response.json()["id"]
    print(f"✓ Material creado. ID: {material_id}")

    # 3. CRM: Crear Cliente
    log_step(3, f"Registro de Cliente: {CLIENT_NAME}")
    payload_cli = {
        "nombre": CLIENT_NAME,
        "telefono": "555-1234",
        "email": f"test_{TEST_ID}@example.com",
        "direccion": "Calle Falsa 123"
    }
    response = client.post("/api/clientes", json=payload_cli, headers=headers)
    assert response.status_code == 200, f"Fallo al crear cliente: {response.text}"
    cliente_id = response.json()["id"]
    print(f"✓ Cliente registrado. ID: {cliente_id}")

    # 4. VENTAS: Crear Presupuesto
    log_step(4, "Generación de Presupuesto")
    payload_pres = {
        "cliente_id": cliente_id,
        "observaciones": "Presupuesto E2E Automatizado",
        "lineas": [
            {
                "material": MATERIAL_NAME,
                "metros_cuadrados": 2.5,
                "medidas": "250x100",
                "precio_unitario": 150.0,
                "condiciones": "Standard",
                "cortes_especiales": False,
                "agujeros": 0,
                "recargo_extra": 0
            }
        ]
    }
    response = client.post("/api/presupuestos", json=payload_pres, headers=headers)
    assert response.status_code == 200, f"Fallo al crear presupuesto: {response.text}"
    presupuesto_data = response.json()
    presupuesto_id = presupuesto_data["id"]
    print(f"✓ Presupuesto creado. ID: {presupuesto_id}. Total: {presupuesto_data['total']}")

    # 5. PRODUCCIÓN: Generar Orden de Trabajo (Etiqueta)
    log_step(5, "Generación de Orden de Trabajo (Etiqueta)")
    # Simulamos la lógica del frontend de "generarEtiquetaDesdeHistorial" llamando a crear trabajo
    payload_trabajo = {
        "cliente": CLIENT_NAME,
        "material_id": material_id,
        "piezas": [{"w": 250, "h": 100, "qty": 1}],
        "presupuesto_id": presupuesto_id,
        "prioridad": "alta"
    }
    response = client.post("/api/trabajos", json=payload_trabajo, headers=headers)
    assert response.status_code == 200, f"Fallo al crear trabajo: {response.text}"
    trabajo_id = response.json()["id"]
    print(f"✓ Orden de Trabajo generada. ID: {trabajo_id}")

    # 6. PRODUCCIÓN: Validar Regla de Oro
    log_step(6, "Validación de Regla de Oro (Visita + Seña + Aprobación)")
    
    # Intento fallido de movimiento antes de validar (Opcional, verificamos que el sistema permita o advierta)
    # Por ahora, aplicamos las validaciones
    
    # Visita
    res = client.post(f"/api/trabajos/{trabajo_id}/validar/visita", headers=headers)
    assert res.status_code == 200
    print("- Visita Técnica: OK")
    
    # Seña
    res = client.post(f"/api/trabajos/{trabajo_id}/validar/sena", headers=headers)
    assert res.status_code == 200
    print("- Seña Abonada: OK")
    
    # Aprobación
    res = client.post(f"/api/trabajos/{trabajo_id}/validar/aprobacion", headers=headers)
    assert res.status_code == 200
    print("- Aprobación Jefe: OK")
    
    print("✓ Regla de Oro cumplida completamente")

    # 7. PRODUCCIÓN: Movimiento Kanban
    log_step(7, "Flujo de Producción (Kanban)")
    
    # Pendiente -> Corte
    response = client.post(f"/api/produccion/orden/{trabajo_id}/actualizar-estado", json={"nuevo_estado": "corte"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["estado"] == "corte"
    print("✓ Estado actualizado a: Corte")
    
    # Corte -> Terminacion
    response = client.post(f"/api/produccion/orden/{trabajo_id}/actualizar-estado", json={"nuevo_estado": "terminacion"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["estado"] == "terminacion"
    print("✓ Estado actualizado a: Terminación")

    # 8. VERIFICACIÓN FINAL EN DB
    log_step(8, "Verificación de Consistencia en BD")
    db = SessionLocal()
    try:
        t = db.query(Trabajo).filter(Trabajo.id == trabajo_id).first()
        assert t is not None
        assert t.estado == "terminacion"
        assert t.visita_tecnica is True
        assert t.aprobado_jefe is True
        assert t.sena_abonada is True
        assert t.presupuesto_id == presupuesto_id
        print("✓ Datos en base de datos verificados correctamente")
        
        # Cleanup
        db.delete(t)
        db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).delete()
        db.query(Cliente).filter(Cliente.id == cliente_id).delete()
        db.query(Material).filter(Material.id == material_id).delete()
        db.commit()
        print("✓ Limpieza de datos de prueba realizada")
        
    finally:
        db.close()

    print(f"\n{'='*50}")
    print("RESULTADO FINAL: PRUEBA EXITOSA")
    print(f"{'='*50}")

if __name__ == "__main__":
    try:
        test_e2e_full_process()
    except AssertionError as e:
        print(f"\n❌ PRUEBA FALLIDA: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR INESPERADO: {e}")
        sys.exit(1)
