import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def login():
    print("Attempting login...")
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"usuario": "admin", "password": "admin"})
        if resp.status_code == 200:
            print("Login successful")
            return resp.json()["token"]
        else:
            print(f"Login failed: {resp.status_code} - {resp.text}")
            return None
    except Exception as e:
        print(f"Connection error: {e}")
        return None

def test_lista_pendientes(token):
    print("\nTesting GET /api/trabajos...")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(f"{BASE_URL}/api/trabajos", headers=headers)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Success! Retrieved {len(data)} items.")
            if len(data) > 0:
                print("First item sample:")
                print(json.dumps(data[0], indent=2))
        else:
            print("Failed!")
            print(resp.text)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    token = login()
    if token:
        test_lista_pendientes(token)
