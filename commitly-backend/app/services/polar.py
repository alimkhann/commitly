from typing import Optional

from polar_sdk import Polar

from app.core.config import settings


class PolarConfigurationError(Exception):
    pass


class PolarService:
    """Creates Polar checkout sessions for donations."""

    def __init__(self) -> None:
        if not settings.polar_access_token or not settings.polar_product_id or not settings.polar_success_url:
            raise PolarConfigurationError(
                "Polar configuration is incomplete. Please set POLAR_ACCESS_TOKEN, POLAR_PRODUCT_ID, and POLAR_SUCCESS_URL."
            )

        server = settings.polar_server if settings.polar_server in {"production", "sandbox"} else "production"

        self.client = Polar(
            access_token=settings.polar_access_token,
            server=server,
        )

    def create_checkout(self, amount_cents: Optional[int] = None, email: Optional[str] = None) -> dict:
        payload: dict = {
            "products": [settings.polar_product_id],
            "success_url": str(settings.polar_success_url),
        }
        # For pay-what-you-want, do not include amount. If provided, validate range (50..99_999_999)
        if amount_cents is not None:
            if not (50 <= amount_cents <= 99_999_999):
                raise ValueError("amount_cents must be between 50 and 99,999,999")
            payload["amount"] = amount_cents
        if email:
            payload["customer_email"] = email

        result = self.client.checkouts.create(request=payload)
        # result contains url and id; return a simple dict
        return {"id": result.id, "url": result.url}
