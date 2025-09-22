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

        # Note: For donations we only request a checkout URL, which requires valid POLAR_* env vars.
        # Uncomment to smoke test when configured:
        # donate_req = {"amount_cents": 500, "email": "donor@example.com"}
        # response = requests.post(f"{BASE_URL}/api/v1/donate/checkout", json=donate_req, timeout=5)
        # print(f"Donate: {response.status_code} - {response.json()}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_api()
