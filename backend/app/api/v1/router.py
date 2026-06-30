from fastapi import APIRouter
from app.api.v1.endpoints import auth, datasets, predictions, ai_chat, analytics, reports, admin, notifications

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["Predictions"])
api_router.include_router(ai_chat.router, prefix="/chat", tags=["AI Chat"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
