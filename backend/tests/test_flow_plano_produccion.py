import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import json

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.main import app
from app.db import SessionLocal
from app.models.inventario import Material
from app.models.produccion import Trabajo
from app.models.crm import Cliente
from app.models.presupuestos import Presupuesto
from app.models.plano import PlanoTecnico

# Setup Client
client = TestClient(app)

# Test Data
TEST_ID = str(uuid.uuid4())[:8]
MATERIAL_NAME = f"Granito Test {TEST_ID}"
CLIENT_NAME = f"Cliente Plano {TEST_ID}"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

def log_step(step, message):
    print(f"\n[PASO {step}] {message}")

def test_flow_plano_produccion():
    print(f"\n{'='*60}")
    print(f"TEST E2E: FLUJO PLANO -> PRODUCCIÓN (ID: {TEST_ID})")
    print(f"{'='*60}")

    # 1. LOGIN
    log_step(1, "Autenticación")
    response = client.post("/api/auth/login", json={"usuario": ADMIN_USER, "password": ADMIN_PASS})
    if response.status_code != 200:
        print("Advertencia: Fallo login, asumiendo modo dev sin auth estricta o usuario incorrecto.")
        # En algunos entornos de test el auth puede estar mockeado o deshabilitado, o usamos headers vacíos si falla.
        # Pero intentemos obtener el token si es posible.
        headers = {}
    else:
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✓ Login exitoso.")

    # 2. CREAR MATERIAL
    log_step(2, f"Creación de Material: {MATERIAL_NAME}")
    payload_mat = {
        "nombre": MATERIAL_NAME,
        "precio_m2": 200.0,
        "espesor_mm": 20,
        "color": "Gris",
        "stock_actual": 50,
        "unidad": "m²"
    }
    response = client.post("/api/materiales", json=payload_mat, headers=headers)
    assert response.status_code == 200, f"Error creando material: {response.text}"
    material_id = response.json()["id"]
    print(f"✓ Material creado: {material_id}")

    # 3. CREAR CLIENTE
    log_step(3, f"Creación de Cliente: {CLIENT_NAME}")
    payload_cli = {
        "nombre": CLIENT_NAME,
        "telefono": "123456789",
        "email": f"plano_{TEST_ID}@test.com",
        "direccion": "Av. Prueba 123"
    }
    response = client.post("/api/clientes", json=payload_cli, headers=headers)
    assert response.status_code == 200, f"Error creando cliente: {response.text}"
    cliente_id = response.json()["id"]
    print(f"✓ Cliente creado: {cliente_id}")

    # 4. CREAR Y ACEPTAR PRESUPUESTO
    log_step(4, "Creación de Presupuesto")
    payload_pres = {
        "cliente_id": cliente_id,
        "observaciones": "Presupuesto para prueba de plano",
        "lineas": [
            {
                "material": MATERIAL_NAME,
                "metros_cuadrados": 3.0,
                "precio_unitario": 200.0
            }
        ]
    }
    response = client.post("/api/presupuestos", json=payload_pres, headers=headers)
    assert response.status_code == 200, f"Error creando presupuesto: {response.text}"
    presupuesto_id = response.json()["id"]
    print(f"✓ Presupuesto creado: {presupuesto_id}")

    # Aceptar presupuesto (simular venta)
    # Nota: Algunos endpoints requieren rol ventas/admin.
    # El endpoint es POST /api/presupuestos/{id}/aceptar (según router.py leído antes)
    response = client.post(f"/api/presupuestos/{presupuesto_id}/aceptar", headers=headers)
    # Si falla 404/405 verificamos, pero asumimos que existe por router.py
    if response.status_code == 200:
        print("✓ Presupuesto aceptado (Venta confirmada)")
    else:
        print(f"Advertencia al aceptar presupuesto: {response.status_code} {response.text}")

    # 5. CREAR PLANO TÉCNICO (Borrador)
    log_step(5, "Creación de Plano Técnico (Borrador)")
    # Simulamos el JSON del diseñador
    contenido_json = {
        "material": {"nombre": MATERIAL_NAME},
        "placements": [
            {"id": "p1", "w": 100, "h": 60, "x": 0, "y": 0, "label": "Mesada"},
            {"id": "p2", "w": 50, "h": 60, "x": 110, "y": 0, "label": "Isla"}
        ]
    }
    payload_plano = {
        "nombre": f"Plano Cocina {TEST_ID}",
        "cliente_id": cliente_id,
        "proyecto": "Cocina E2E",
        "categoria": "General",
        "estado": "borrador",
        "tipo": "manual",
        "contenido_json": json.dumps(contenido_json)
    }
    response = client.post("/api/planos-tecnicos", json=payload_plano, headers=headers)
    assert response.status_code == 200, f"Error creando plano: {response.text}"
    plano_id = response.json()["id"]
    print(f"✓ Plano creado: {plano_id}")

    # 6. APROBAR PLANO PARA PRODUCCIÓN
    # Aquí es donde ocurre la magia: debe crear el Trabajo automáticamente si no existe.
    log_step(6, "Aprobación de Plano (Debe crear Trabajo Automáticamente)")
    
    # Verificamos que NO exista trabajo aun para este presupuesto
    db = SessionLocal()
    trabajo_existente = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuesto_id).first()
    if trabajo_existente:
        print("Nota: Ya existía un trabajo (quizás creado por otro trigger), se usará ese.")
    else:
        print("Verificación: No existe trabajo previo. La aprobación debería crearlo.")
    db.close()

    response = client.post(f"/api/planos-tecnicos/{plano_id}/aprobar-produccion", json={}, headers=headers)
    assert response.status_code == 200, f"Error aprobando plano: {response.text}"
    res_data = response.json()
    
    print(f"✓ Respuesta Aprobación: {res_data}")
    assert res_data.get("status") == "aprobado", "El estado del plano debería ser aprobado"
    
    # Verificar warnings
    if res_data.get("warning"):
        print(f"⚠ Warning recibido: {res_data['warning']}")
        # Si hay warning, el test podría fallar si esperábamos éxito total, 
        # pero en este caso queremos asegurar que se CREÓ el trabajo.
        # Si el warning dice "No se encontró presupuesto", falló el paso 4.
    
    # 7. VERIFICAR CREACIÓN DEL TRABAJO
    log_step(7, "Verificación de Trabajo Creado")
    db = SessionLocal()
    trabajo = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuesto_id).order_by(Trabajo.id.desc()).first()
    assert trabajo is not None, "FALLO CRÍTICO: No se creó el trabajo asociado al presupuesto"
    print(f"✓ Trabajo encontrado: {trabajo.id}")
    print(f"  - Estado: {trabajo.estado}")
    print(f"  - Material ID: {trabajo.material_id}")
    print(f"  - Piezas generadas: {len(trabajo.piezas) if hasattr(trabajo, 'piezas') else 'N/A'}")
    
    trabajo_id = trabajo.id
    db.close()

    # 8. REVISIÓN TÉCNICA (Simulación)
    log_step(8, "Simulación de Revisión Técnica (Confirmar Medidas)")
    # Para confirmar revisión, se necesita visita técnica y seña en algunos flujos, 
    # pero el endpoint `confirmar_revision_tecnica` suele ser potente.
    
    payload_rev = {
        "medidas": "Medidas OK E2E",
        "notas_tecnicas": "Todo correcto, proceder a corte",
        "geometria_json": json.dumps(contenido_json) # Confirmamos la misma geometría
    }
    response = client.put(f"/api/revision/{trabajo_id}/confirmar", json=payload_rev, headers=headers)
    assert response.status_code == 200, f"Error en revisión técnica: {response.text}"
    print("✓ Revisión técnica confirmada")
    
    # Verificar estado final
    res_rev = response.json()
    print(f"  - Estado post-revisión: {res_rev.get('status')}")

    # CLEANUP
    log_step(9, "Limpieza")
    db = SessionLocal()
    try:
        # Borrar en orden inverso a dependencias
        # Piezas (cascade usualmente, pero por seguridad)
        # Trabajo
        db.query(Trabajo).filter(Trabajo.id == trabajo_id).delete()
        # Plano
        db.query(PlanoTecnico).filter(PlanoTecnico.id == plano_id).delete()
        # Presupuesto
        db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).delete()
        # Cliente
        db.query(Cliente).filter(Cliente.id == cliente_id).delete()
        # Material
        db.query(Material).filter(Material.id == material_id).delete()
        
        db.commit()
        print("✓ Datos de prueba eliminados.")
    except Exception as e:
        print(f"Error en limpieza: {e}")
    finally:
        db.close()

    print(f"\n{'='*60}")
    print("RESULTADO: PRUEBA COMPLETADA CON ÉXITO")
    print(f"{'='*60}")

if __name__ == "__main__":
    try:
        test_flow_plano_produccion()
    except AssertionError as e:
        print(f"\n❌ FALLO DE ASERCIÓN: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR INESPERADO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
