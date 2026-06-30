from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time
from loguru import logger

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router
from app.core.redis import redis_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Enterprise AI BI Platform...")
    try:
        await redis_client.ping()
        logger.info("Redis connected.")
    except Exception as e:
        logger.warning(f"Redis not available: {e}")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise AI Business Intelligence & Analytics Platform API",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,

)
print("=" * 60)
print("MAIN.PY LOADED")
print("=" * 60)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
