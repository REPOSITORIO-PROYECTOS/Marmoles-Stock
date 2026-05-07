import sys
import os
import json

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# FORCE SQLite for testing
os.environ["DATABASE_URL"] = "sqlite:///./repro_test.db"

# Clean up previous run
if os.path.exists("repro_test.db"):
    try:
        os.remove("repro_test.db")
    except:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.auth import get_current_user
from app.models import Trabajo, Material, Base
from app.db import SessionLocal

# Mock user
class MockUser:
    id = "1"
    username = "admin"
    role = "admin"
    active = True

async def mock_get_current_user():
    return MockUser()

app.dependency_overrides[get_current_user] = mock_get_current_user

client = TestClient(app)

def test_lista_pendientes():
    # Insert test data
    db = SessionLocal()
    try:
        # Create Material
        mat = Material(nombre="Granito Test", precio_m2=100.0, color="Negro")
        db.add(mat)
        db.commit()
        db.refresh(mat)
        
        # Create Trabajo
        t = Trabajo(
            cliente="Cliente Test",
            material_id=mat.id,
            estado="pendiente",
            prioridad="alta"
        )
        db.add(t)
        db.commit()
        print(f"Inserted Trabajo {t.id} with Material {mat.id}")
    finally:
        db.close()

    print("Testing GET /api/trabajos...")
    try:
        response = client.get("/api/trabajos")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Success! Retrieved {len(data)} items.")
            if len(data) > 0:
                print("First item sample:")
                print(json.dumps(data[0], indent=2, default=str))
                
                # Validation
                assert data[0]["cliente"] == "Cliente Test"
                assert data[0]["material_nombre"] == "Granito Test"
                print("Validation Passed!")
        else:
            print("Failed!")
            print(response.text)
    except Exception as e:
        print(f"Exception occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_lista_pendientes()
