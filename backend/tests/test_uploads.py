import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
import os
import shutil

client = TestClient(app)

def test_upload_flow():
    # Setup Auth Mock
    from app.auth import get_current_user
    
    class MockUser:
        id = "1"
        username = "admin"
        role = "admin"
        active = True
        
    async def mock_get_current_user():
        return MockUser()
        
    app.dependency_overrides[get_current_user] = mock_get_current_user

    # Create a dummy file
    filename = "test_image.txt"
    with open(filename, "w") as f:
        f.write("This is a test image content.")

    try:
        # 1. Upload File
        print("Uploading file...")
        with open(filename, "rb") as f:
            r = client.post("/api/uploads", files={"file": (filename, f, "text/plain")})
        
        if r.status_code != 200:
            print(f"Upload failed: {r.text}")
            return

        data = r.json()
        url = data["url"]
        print(f"File uploaded. URL: {url}")
        
        # 2. Verify File Access (Static)
        print("Verifying static access...")
        r_static = client.get(url)
        if r_static.status_code != 200:
            print(f"Static access failed: {r_static.status_code}")
            return
            
        content = r_static.text
        assert content == "This is a test image content."
        print("Static access verified.")

    finally:
        if os.path.exists(filename):
            os.remove(filename)
        # Cleanup uploaded file if needed, but it's in app/uploads

if __name__ == "__main__":
    test_upload_flow()
