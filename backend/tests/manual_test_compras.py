import json
import urllib.request

BASE = "http://localhost:8000"

def post(url: str, payload: dict, headers: dict | None = None):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **(headers or {})}, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            body = res.read().decode()
            print("STATUS", res.status)
            print(body)
            return res.status, body
    except urllib.error.HTTPError as e:
        print("STATUS", e.code)
        try:
            print(e.read().decode())
        except Exception:
            print("<no body>")
        return e.code, None

def main():
    status, body = post(f"{BASE}/api/auth/login", {"usuario": "admin", "password": "adminpass"})
    if status != 200 or not body:
        print("Login failed")
        return
    token = json.loads(body).get("token")
    headers = {"Authorization": f"Bearer {token}"}
    post(f"{BASE}/api/compras", {"proveedor": "Proveedor QA", "material": "Gris Mara", "cantidad": 5, "monto": 1000, "fecha": "2025-11-27"}, headers)

if __name__ == "__main__":
    main()

