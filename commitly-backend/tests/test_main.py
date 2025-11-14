from fastapi.testclient import TestClient


def test_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("message") == "Commitly Backend API"
    assert data.get("version") == "1.0.0"


def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_docs_require_auth(client: TestClient):
    response = client.get("/docs")
    assert response.status_code == 401


def test_docs_allow_authenticated(client: TestClient, auth_headers):
    response = client.get("/docs", headers=auth_headers)
    assert response.status_code == 200
