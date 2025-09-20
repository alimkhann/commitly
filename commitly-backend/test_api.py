import requests
import json

BASE_URL = "http://localhost:8000"

def test_api():
    try:
        # Test health
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Health: {response.status_code} - {response.json()}")
        
        # Test waitlist
        data = {"email": "test@example.com", "source": "landing"}
        response = requests.post(f"{BASE_URL}/api/v1/waitlist/", json=data, timeout=5)
        print(f"Waitlist: {response.status_code} - {response.json()}")
        
        # Test count
        response = requests.get(f"{BASE_URL}/api/v1/waitlist/count", timeout=5)
        print(f"Count: {response.status_code} - {response.json()}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
