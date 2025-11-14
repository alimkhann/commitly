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


def test_auth_ping_allows_normalized_authorized_party(
    client: TestClient, make_clerk_token
):
    from app.core.config import settings

    original = list(settings.clerk_authorized_parties)
    try:
        settings.clerk_authorized_parties = ["commitly-m005.onrender.com"]
        normalized_token = make_clerk_token(azp="https://commitly-m005.onrender.com/")
        response = client.get(
            "/api/v1/auth/ping",
            headers={"Authorization": f"Bearer {normalized_token}"},
        )
        assert response.status_code == 200
    finally:
        settings.clerk_authorized_parties = original
