import logging
import sys

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse

from app.api import auth, donate, github, roadmap, waitlist
from app.core.auth import ClerkAuthMiddleware, ClerkClaims, require_clerk_auth
from app.core.config import settings


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

app = FastAPI(
    title=settings.project_name,
    debug=settings.debug,
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ClerkAuthMiddleware)

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
    dependencies=protected,
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
