from fastapi.testclient import TestClient


class _FakePolarService:
    def __init__(self, *_, **__):
        pass

    def create_checkout(self, amount_cents=None, email=None):  # noqa: ARG002
        return {"id": "chk_123", "url": "https://pay.local/checkout/chk_123"}


def test_donate_checkout_success(monkeypatch, client: TestClient):
    from app.api import donate as donate_api

    monkeypatch.setattr(donate_api, "PolarService", _FakePolarService)

    payload = {"amount_cents": 1500, "email": "donor@example.com"}
    response = client.post("/api/v1/donate/checkout", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["checkout_id"] == "chk_123"
    assert data["url"].startswith("https://")


def test_donate_checkout_config_error(monkeypatch, client: TestClient):
    from app.api import donate as donate_api

    class _BrokenService(_FakePolarService):
        def __init__(self, *_, **__):  # raises on init
            raise donate_api.PolarConfigurationError("missing config")

    monkeypatch.setattr(donate_api, "PolarService", _BrokenService)
    response = client.post("/api/v1/donate/checkout", json={})
    assert response.status_code == 503


def test_donate_checkout_validation_error(monkeypatch, client: TestClient):
    from app.api import donate as donate_api

    class _ValidatingService(_FakePolarService):
        def create_checkout(self, amount_cents=None, email=None):  # noqa: ARG002
            raise ValueError("bad amount")

    monkeypatch.setattr(donate_api, "PolarService", _ValidatingService)
    response = client.post("/api/v1/donate/checkout", json={"amount_cents": 1})
    assert response.status_code == 422
