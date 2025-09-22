from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import waitlist
from app.api import donate

app = FastAPI(
    title=settings.project_name,
    debug=settings.debug,
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    waitlist.router,
    prefix=f"{settings.api_v1_str}/waitlist",
    tags=["waitlist"]
)

app.include_router(
    donate.router,
    prefix=f"{settings.api_v1_str}/donate",
    tags=["donate"]
)

@app.get("/")
async def root():
    return {"message": "Commitly Backend API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
