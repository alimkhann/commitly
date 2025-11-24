from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from app.services.roadmap_service import RoadmapService


class _FakeCache:
    def __init__(self, payload):
        self._payload = payload

    async def get(self, key):
        return self._payload


@pytest.mark.asyncio
async def test_generate_pins_user_when_returning_cached_response():
    cached_payload = {
        "repo": {
            "full_name": "acme/widgets",
            "description": "Repo",
            "language": "python",
            "stars": 1,
            "default_branch": "main",
            "html_url": None,
            "owner_avatar_url": None,
        },
        "timeline": [
            {
                "id": "stage-1",
                "title": "Init",
                "summary": "setup",
                "status": "done",
                "eta": "1m",
                "tasks": [],
                "resources": [],
            }
        ],
        "cached": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    pin_store = MagicMock()
    service = RoadmapService(
        chunk_store=MagicMock(),
        result_store=MagicMock(),
        pin_store=pin_store,
        generator=MagicMock(),
        token_store=MagicMock(),
        cache=_FakeCache(cached_payload),
    )

    response = await service.generate(
        "https://github.com/acme/widgets", actor_id="user-1"
    )

    assert response.repo.full_name == "acme/widgets"
    pin_store.pin.assert_called_once_with("user-1", "acme/widgets")
