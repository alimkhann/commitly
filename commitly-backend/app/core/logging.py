from __future__ import annotations

import contextvars
import json
import logging
import time
from datetime import datetime, timezone
from logging.config import dictConfig
from typing import Any, Dict, MutableMapping, Optional
from uuid import uuid4

from app.core.config import settings
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.types import ASGIApp

RequestContext = Dict[str, Any]

_request_context: contextvars.ContextVar[RequestContext] = contextvars.ContextVar(
    "request_context", default={}
)
_LOGGING_CONFIGURED = False


class RequestContextFilter(logging.Filter):
    """Inject per-request context stored in a ContextVar into all log records."""

    def filter(self, record: logging.LogRecord) -> bool:  # pragma: no cover - simple
        context = dict(_request_context.get() or {})
        for key, value in context.items():
            setattr(record, key, value)
        return True


class JsonFormatter(logging.Formatter):
    """Render log records as structured JSON."""

    def format(self, record: logging.LogRecord) -> str:  # pragma: no cover - formatting
        log: MutableMapping[str, Any] = {
            "timestamp": self._format_timestamp(record.created),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        for attr in (
            "request_id",
            "client_ip",
            "method",
            "path",
            "status_code",
            "elapsed_ms",
            "user_id",
            "event",
        ):
            value = getattr(record, attr, None)
            if value not in (None, ""):
                log[attr] = value

        if record.exc_info:
            log["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            log["stack"] = self.formatStack(record.stack_info)

        return json.dumps(log, ensure_ascii=False)

    @staticmethod
    def _format_timestamp(created: float) -> str:
        return datetime.fromtimestamp(created, tz=timezone.utc).isoformat()


def bind_request_context(**kwargs: Any) -> None:
    """Merge values into the request-scoped logging context."""

    current = dict(_request_context.get() or {})
    current.update({k: v for k, v in kwargs.items() if v is not None})
    _request_context.set(current)


def clear_request_context() -> None:
    """Reset the request-scoped logging context."""

    _request_context.set({})


class ConsoleFormatter(logging.Formatter):
    """Render log records as human-readable text."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        level = record.levelname
        logger_name = record.name
        message = record.getMessage()

        extras = []
        for attr in (
            "request_id",
            "method",
            "path",
            "status_code",
            "elapsed_ms",
            "user_id",
            "client_ip",
        ):
            value = getattr(record, attr, None)
            if value not in (None, ""):
                extras.append(f"{attr}={value}")

        extra_str = " ".join(extras)
        if extra_str:
            extra_str = f" [{extra_str}]"

        formatted = f"{timestamp} [{level}] {logger_name}: {message}{extra_str}"

        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"
        if record.stack_info:
            formatted += f"\n{self.formatStack(record.stack_info)}"

        return formatted


def configure_logging() -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return

    level = "DEBUG" if settings.debug else "INFO"
    # Use ConsoleFormatter for local development readability
    _ = (
        "app.core.logging.ConsoleFormatter"
        if settings.debug
        else "app.core.logging.JsonFormatter"
    )

    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "()": "app.core.logging.JsonFormatter",
                },
                "console": {
                    "()": "app.core.logging.ConsoleFormatter",
                },
            },
            "filters": {
                "request_context": {
                    "()": "app.core.logging.RequestContextFilter",
                }
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "filters": ["request_context"],
                    "formatter": "console" if settings.debug else "json",
                    "stream": "ext://sys.stdout",
                }
            },
            "loggers": {
                "": {"handlers": ["default"], "level": level},
                "uvicorn": {
                    "handlers": ["default"],
                    "level": level,
                    "propagate": False,
                },
                "uvicorn.error": {
                    "handlers": ["default"],
                    "level": level,
                    "propagate": False,
                },
                "uvicorn.access": {
                    "handlers": ["default"],
                    "level": "WARNING",
                    "propagate": False,
                },
                "httpcore": {
                    "handlers": ["default"],
                    "level": "WARNING",
                    "propagate": False,
                },
                "httpx": {
                    "handlers": ["default"],
                    "level": "WARNING",
                    "propagate": False,
                },
            },
        }
    )
    _LOGGING_CONFIGURED = True


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Capture per-request diagnostics (latency, user ID, request ID)."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.logger = logging.getLogger("app.request")

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ):  # type: ignore[override]
        request_id = (
            request.headers.get("X-Request-ID")
            or request.headers.get("X-Request-Id")
            or uuid4().hex
        )
        client_ip: Optional[str] = request.client.host if request.client else None

        bind_request_context(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client_ip=client_ip,
        )

        start = time.perf_counter()
        self.logger.info("request.started", extra={"event": "request_start"})

        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - start) * 1000
            bind_request_context(elapsed_ms=round(elapsed_ms, 2), status_code=500)
            self.logger.exception("request.failed", extra={"event": "request_error"})
            raise
        else:
            elapsed_ms = (time.perf_counter() - start) * 1000
            claims: Optional[Dict[str, Any]] = getattr(
                request.state, "clerk_claims", None
            )
            user_id = claims.get("sub") if isinstance(claims, dict) else None

            bind_request_context(
                elapsed_ms=round(elapsed_ms, 2),
                status_code=response.status_code,
                user_id=user_id,
            )
            response.headers.setdefault("X-Request-ID", request_id)
            self.logger.info(
                "request.completed",
                extra={"event": "request_complete"},
            )
            return response
        finally:
            clear_request_context()
