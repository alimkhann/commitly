from typing import Optional

from polar_sdk import Polar

from app.core.config import settings


class PolarConfigurationError(Exception):
    pass


class PolarService:
    """Creates Polar checkout sessions for donations."""

    def __init__(self) -> None:
        server_flag = (settings.polar_server or "").strip().lower()
        use_sandbox = settings.polar_sandbox_enabled or server_flag in {"sandbox", "true", "1", "yes"}

        if use_sandbox:
            access_token = settings.polar_sandbox_access_token
            product_id = settings.polar_sandbox_product_id
            success_url = settings.polar_sandbox_success_url or settings.polar_success_url
            server = "sandbox"
            config_name = "sandbox"
        else:
            access_token = settings.polar_access_token
            product_id = settings.polar_product_id
            success_url = settings.polar_success_url
            server = "production" if server_flag != "sandbox" else "sandbox"
            config_name = "production"

        missing_fields = [
            name
            for name, value in (
                ("POLAR_ACCESS_TOKEN" if not use_sandbox else "POLAR_SANDBOX_ACCESS_TOKEN", access_token),
                ("POLAR_PRODUCT_ID" if not use_sandbox else "POLAR_SANDBOX_PRODUCT_ID", product_id),
                ("POLAR_SUCCESS_URL" if not use_sandbox else "POLAR_SANDBOX_SUCCESS_URL", success_url),
            )
            if value is None
        ]
        if missing_fields:
            joined = ", ".join(missing_fields)
            raise PolarConfigurationError(f"Polar {config_name} configuration is incomplete. Missing: {joined}.")

        self._success_url = str(success_url)
        self._product_id = str(product_id)

        self.client = Polar(
            access_token=access_token,
            server=server,
        )

    def create_checkout(self, amount_cents: Optional[int] = None, email: Optional[str] = None) -> dict:
        payload: dict = {
            "products": [self._product_id],
            "success_url": self._success_url,
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
