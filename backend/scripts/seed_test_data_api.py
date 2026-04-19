import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"

def req(method, path, token=None, payload=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        return json.loads(body) if body else None

def try_post(path, token, payload):
    try:
        req("POST", path, token=token, payload=payload)
    except Exception:
        pass

def main():
    login = req("POST", "/api/auth/login", payload={"usuario": "admin", "password": "admin"})
    token = login.get("token")
    if not token:
        raise RuntimeError("No se obtuvo token")

    clientes = [
        {"nombre": "Juan Perez", "email": "juan.perez@test.com", "telefono": "3415551001", "direccion": "Av. Pellegrini 1234", "coordenadas": "-32.9575,-60.6394"},
        {"nombre": "Maria Gomez", "email": "maria.gomez@test.com", "telefono": "3415551002", "direccion": "Bv. Orono 850", "coordenadas": "-32.9442,-60.6505"},
        {"nombre": "Carlos Ruiz", "email": "carlos.ruiz@test.com", "telefono": "3415551003", "direccion": "San Martin 2100", "coordenadas": "-32.9500,-60.6400"},
    ]
    for c in clientes:
        try_post("/api/clientes", token, c)

    materiales = [
        {"nombre": "Cuarzo Blanco Test", "precio_m2": 78000, "precio_mayor_m2": 72000, "espesor_mm": 20, "color": "Blanco", "ancho_m": 1.60, "largo_m": 3.20, "stock_actual": 0, "unidad": "m2", "stock_minimo": 3},
        {"nombre": "Granito Negro Test", "precio_m2": 69000, "precio_mayor_m2": 64000, "espesor_mm": 20, "color": "Negro", "ancho_m": 1.60, "largo_m": 3.00, "stock_actual": 0, "unidad": "m2", "stock_minimo": 2},
        {"nombre": "Marmol Carrara Test", "precio_m2": 91000, "precio_mayor_m2": 86000, "espesor_mm": 20, "color": "Gris", "ancho_m": 1.50, "largo_m": 2.80, "stock_actual": 0, "unidad": "m2", "stock_minimo": 2},
    ]
    for m in materiales:
        try_post("/api/materiales", token, m)

    compras = [
        {"proveedor": "Proveedor Demo", "material": "Cuarzo Blanco Test", "cantidad": 6, "monto": 540000, "fecha": "2026-04-02", "lote": "LT-QZ-001", "ancho_m": 1.60, "largo_m": 3.20, "precio_m2": 78000, "precio_mayor_m2": 72000, "ubicacion": "Rack A1"},
        {"proveedor": "Proveedor Demo", "material": "Granito Negro Test", "cantidad": 4, "monto": 360000, "fecha": "2026-04-02", "lote": "LT-GR-001", "ancho_m": 1.60, "largo_m": 3.00, "precio_m2": 69000, "precio_mayor_m2": 64000, "ubicacion": "Rack B2"},
        {"proveedor": "Proveedor Demo", "material": "Marmol Carrara Test", "cantidad": 3, "monto": 330000, "fecha": "2026-04-02", "lote": "LT-MC-001", "ancho_m": 1.50, "largo_m": 2.80, "precio_m2": 91000, "precio_mayor_m2": 86000, "ubicacion": "Rack C1"},
    ]
    for cp in compras:
        try_post("/api/compras", token, cp)

    articulos = [
        {"nombre": "Pileta Simple Test", "descripcion": "Pileta de acero inoxidable", "precio_unitario": 120000, "categoria": "articulo", "activo": True},
        {"nombre": "Griferia Monocomando Test", "descripcion": "Griferia cocina", "precio_unitario": 95000, "categoria": "accesorio", "activo": True},
        {"nombre": "Dosificador Test", "descripcion": "Dosificador embutido", "precio_unitario": 38000, "categoria": "accesorio", "activo": True},
    ]
    for a in articulos:
        try_post("/api/articulos", token, a)

    servicios = [
        {"nombre": "Flete Capital Test", "precio_base": 25000, "categoria": "ExtraPresupuesto", "unidad": "u"},
        {"nombre": "Instalacion Completa Test", "precio_base": 45000, "categoria": "ExtraPresupuesto", "unidad": "u"},
    ]
    for s in servicios:
        try_post("/api/servicios", token, s)

    clientes_count = len(req("GET", "/api/clientes", token=token) or [])
    materiales_count = len(req("GET", "/api/materiales", token=token) or [])
    articulos_count = len(req("GET", "/api/articulos", token=token) or [])
    extras_count = len(req("GET", "/api/servicios?categoria=ExtraPresupuesto", token=token) or [])

    print(f"SEED_OK clientes={clientes_count} materiales={materiales_count} articulos={articulos_count} extras={extras_count}")

if __name__ == "__main__":
    main()
