from fastapi.testclient import TestClient


def test_auth_ping_returns_identity(client: TestClient, auth_headers):
    response = client.get("/api/v1/auth/ping", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["user_id"].startswith("user_")


def test_auth_ping_rejects_invalid_token(client: TestClient, make_clerk_token):
    bad_token = make_clerk_token(azp="https://unauthorized.example.com")
    response = client.get(
        "/api/v1/auth/ping", headers={"Authorization": f"Bearer {bad_token}"}
    )
    assert response.status_code == 401
