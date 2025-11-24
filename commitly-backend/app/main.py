import logging
from contextlib import asynccontextmanager

from app.api import auth, github, roadmap, waitlist
from app.core.auth import ClerkAuthMiddleware, ClerkClaims, require_clerk_auth
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import StructuredLoggingMiddleware, configure_logging
from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy import text

configure_logging()
logger = logging.getLogger(__name__)

FIRST_PARTY_ORIGINS = {
    "https://commitly.one",
    "https://www.commitly.one",
    "http://localhost:3700",
    "http://localhost:3000",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Keep startup lightweight: only verify we can talk to the database.
    Heavy schema fixes belong in Alembic migrations (run separately).
    """
    import asyncio

    async def ping_database() -> None:
        def _ping():
            with SessionLocal() as session:
                session.execute(text("SELECT 1"))

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _ping)

    try:
        await asyncio.wait_for(ping_database(), timeout=5.0)
        logger.info("✅ Database connection healthy at startup")
    except asyncio.TimeoutError:
        logger.error("❌ Database ping timed out (5s)")
    except Exception as exc:  # pragma: no cover - startup diagnostic
        logger.error(f"❌ Database ping failed: {exc}", exc_info=True)

    yield
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.project_name,
    debug=settings.debug,
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

# Add CORS middleware
if isinstance(settings.allowed_origins, str):
    configured_origins = [settings.allowed_origins] if settings.allowed_origins else []
else:
    configured_origins = list(settings.allowed_origins or [])

local_dev_origins = {
    "http://localhost:3000",
    "http://localhost:3700",
}

cors_origins = sorted({*configured_origins, *local_dev_origins} - {None, ""})

first_party_origins = {origin.rstrip("/") for origin in FIRST_PARTY_ORIGINS}
if settings.frontend_origin:
    first_party_origins.add(str(settings.frontend_origin).rstrip("/"))

cors_origins = sorted({*cors_origins, *first_party_origins} - {None, ""})

allow_origin_regex = None
allow_credentials = True

if "*" in configured_origins:
    sanitized = sorted({*cors_origins} - {"*"})
    if not sanitized:
        sanitized = sorted({*local_dev_origins, *first_party_origins})
    cors_origins = sanitized
    logger.warning(
        "CORS wildcard detected. Replacing with explicit origins: %s",
        cors_origins,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ClerkAuthMiddleware)
app.add_middleware(StructuredLoggingMiddleware)

# Include routers
protected = [Depends(require_clerk_auth)]

app.include_router(
    waitlist.router,
    prefix=f"{settings.api_v1_str}/waitlist",
    tags=["waitlist"],
)

app.include_router(auth.router, prefix=f"{settings.api_v1_str}/auth", tags=["auth"])
app.include_router(
    roadmap.router,
    prefix=f"{settings.api_v1_str}/roadmap",
    tags=["roadmap"],
)
app.include_router(
    github.router,
    prefix=f"{settings.api_v1_str}",
)


@app.get("/")
async def root():
    return {"message": "Commitly Backend API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/docs", include_in_schema=False)
async def swagger_ui(_: ClerkClaims = Depends(require_clerk_auth)):
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=f"{settings.project_name} Docs",
    )


@app.get("/openapi.json", include_in_schema=False)
async def openapi_json(_: ClerkClaims = Depends(require_clerk_auth)):
    schema = get_openapi(
        title=settings.project_name,
        version="1.0.0",
        routes=app.routes,
    )
    return JSONResponse(schema)


# Global exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch all unhandled exceptions and log them."""
    logger.error(
        f"Unhandled exception: {request.method} {request.url.path}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "path": str(request.url.path),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    logger.warning(
        f"Validation error: {request.method} {request.url.path} - {exc.errors()}"
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body},
    )
