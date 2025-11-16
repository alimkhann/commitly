from contextlib import asynccontextmanager
import logging
import sys

from fastapi import Depends, FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import auth, donate, github, roadmap, waitlist
from app.core.auth import ClerkAuthMiddleware, ClerkClaims, require_clerk_auth
from app.core.config import settings
from app.core.database import SessionLocal


def _configure_logging() -> None:
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)


_configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown."""
    # Startup: Test database connection
    logger.info("Testing database connection...")
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
            session.commit()
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}", exc_info=True)
        # Don't fail startup, but log the error

    # Run database migrations
    logger.info("Running database migrations...")
    try:
        from pathlib import Path
        from alembic.config import Config
        from alembic import command

        project_root = Path(__file__).parent.parent
        alembic_ini = project_root / "alembic.ini"
        
        if not alembic_ini.exists():
            logger.error(f"alembic.ini not found at {alembic_ini}")
        else:
            logger.info(f"Found alembic.ini at {alembic_ini}")
            alembic_cfg = Config(str(alembic_ini))
            
            # Run migrations
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations completed successfully")
    except Exception as e:
        logger.error(f"Database migration failed: {e}", exc_info=True)
        # Don't fail startup, but log the error
    
    # Verify schema: Check if required columns exist
    logger.info("Verifying database schema...")
    try:
        with SessionLocal() as session:
            # Check if primary_language column exists
            result = session.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'generated_roadmaps'
                    AND column_name = 'primary_language'
                    """
                )
            )
            column_exists = result.fetchone() is not None

            if column_exists:
                logger.info("Database schema verified successfully - all required columns exist")
            else:
                logger.error(
                    "Required columns still missing after migration attempt. "
                    "Please check migration files and database connection."
                )
    except Exception as e:
        logger.error(f"Schema verification failed: {e}", exc_info=True)
        # Don't fail startup, but log the error

    yield
    # Shutdown
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
# Ensure allowed_origins is always a list
# (validator should handle this, but type-safe check)
if isinstance(settings.allowed_origins, str):
    cors_origins = [settings.allowed_origins] if settings.allowed_origins else ["*"]
else:
    cors_origins = list(settings.allowed_origins or ["*"])

local_dev_origins = {
    "http://localhost:3000",
    "http://localhost:3700",
}
for origin in local_dev_origins:
    if origin not in cors_origins:
        cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ClerkAuthMiddleware)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests for debugging."""

    async def dispatch(self, request: Request, call_next):
        import time

        start_time = time.time()
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {request.client.host if request.client else 'unknown'}"
        )
        try:
            response = await call_next(request)
            elapsed = time.time() - start_time
            logger.info(
                f"Response: {request.method} {request.url.path} "
                f"-> {response.status_code} ({elapsed:.3f}s)"
            )
            return response
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(
                f"Error processing {request.method} {request.url.path} "
                f"after {elapsed:.3f}s: {type(e).__name__}: {e}",
                exc_info=True,
            )
            raise


app.add_middleware(RequestLoggingMiddleware)

# Include routers
protected = [Depends(require_clerk_auth)]

app.include_router(
    waitlist.router,
    prefix=f"{settings.api_v1_str}/waitlist",
    tags=["waitlist"],
)

app.include_router(
    donate.router,
    prefix=f"{settings.api_v1_str}/donate",
    tags=["donate"],
    dependencies=protected,
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
