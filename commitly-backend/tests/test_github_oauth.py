from fastapi.testclient import TestClient


def test_github_status_default_false(client: TestClient, auth_headers):
    response = client.get("/api/v1/github/oauth/status", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["connected"] is False


def test_github_oauth_start_requires_auth(client: TestClient):
    response = client.post("/api/v1/github/oauth/start")
    assert response.status_code == 401
