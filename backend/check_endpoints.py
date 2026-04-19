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

if __name__ == "__main__":
    check_endpoint("/api/clientes")
    check_endpoint("/api/materiales")
