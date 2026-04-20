import requests
import sys

BASE_URL = "http://localhost:8000"

def check_endpoint(endpoint):
    try:
        print(f"Checking {endpoint}...")
        response = requests.get(f"{BASE_URL}{endpoint}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Success. Type: {type(data)}")
                if isinstance(data, list):
                    print(f"Count: {len(data)}")
                else:
                    print(f"Data: {data}")
            except Exception as e:
                print(f"Error parsing JSON: {e}")
                print(f"Content: {response.text[:200]}")
        else:
            print(f"Error: {response.text[:200]}")
    except Exception as e:
        print(f"Exception: {e}")

def check_openapi_dashboard_stock() -> None:
    """Diagnóstico: el dashboard de stock requiere GET /api/inventario/dashboard/stock en el proceso en ejecución."""
    path_key = "/api/inventario/dashboard/stock"
    try:
        r = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        r.raise_for_status()
        paths = r.json().get("paths") or {}
        has_route = path_key in paths
        print(f"OpenAPI: {path_key} registrado: {has_route}")
        if not has_route:
            print(
                "  -> Reiniciá el backend (uvicorn/docker) desde esta copia del repo; "
                "si el 404 persiste, el proceso no está cargando app.main actualizado."
            )
    except Exception as e:
        print(f"OpenAPI check failed: {e}")

if __name__ == "__main__":
    check_openapi_dashboard_stock()
    check_endpoint("/api/clientes")
    check_endpoint("/api/materiales")
