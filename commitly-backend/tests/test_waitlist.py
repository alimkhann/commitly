from fastapi.testclient import TestClient


def test_join_waitlist_happy_path(client: TestClient, auth_headers):
    payload = {"email": "alice@example.com", "source": "tests"}
    response = client.post("/api/v1/waitlist/", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["source"] == payload["source"]
    assert isinstance(data["id"], int)
    assert data["created_at"]


def test_join_waitlist_duplicate_email(client: TestClient, auth_headers):
    payload = {"email": "dup@example.com", "source": "tests"}
    first = client.post("/api/v1/waitlist/", json=payload, headers=auth_headers)
    assert first.status_code == 201
    dup = client.post("/api/v1/waitlist/", json=payload, headers=auth_headers)
    assert dup.status_code == 409
    assert dup.json() == {"detail": "This email is already on the waitlist."}


def test_waitlist_count(client: TestClient, auth_headers):
    emails = ["a@example.com", "b@example.com", "c@example.com"]
    for e in emails:
        assert (
            client.post(
                "/api/v1/waitlist/",
                json={"email": e, "source": "tests"},
                headers=auth_headers,
            ).status_code
            == 201
        )

    count_resp = client.get("/api/v1/waitlist/count")
    assert count_resp.status_code == 200
    assert count_resp.json() == {"count": len(emails)}


def test_join_waitlist_allows_authenticated_actor(client: TestClient, auth_headers):
    response = client.post(
        "/api/v1/waitlist/",
        json={"email": "authed@example.com", "source": "tests"},
        headers=auth_headers,
    )
    assert response.status_code == 201


def test_waitlist_allows_anonymous_submission(client: TestClient):
    response = client.post(
        "/api/v1/waitlist/",
        json={"email": "anon@example.com", "source": "tests"},
    )
    assert response.status_code == 201
