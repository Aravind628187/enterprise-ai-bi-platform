from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.models import User, Dataset, Prediction, AuditLog, Report, UserRole
from app.schemas.schemas import UserResponse

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.add(user)
    await db.commit()
    return {"message": f"Role updated to {role}"}


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.add(user)
    await db.commit()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    dataset_count = (await db.execute(select(func.count(Dataset.id)))).scalar() or 0
    pred_count = (await db.execute(select(func.count(Prediction.id)))).scalar() or 0
    report_count = (await db.execute(select(func.count(Report.id)))).scalar() or 0

    return {
        "users": user_count,
        "datasets": dataset_count,
        "predictions": pred_count,
        "reports": report_count,
    }


@router.get("/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    logs = result.scalars().all()
    return [{"id": l.id, "action": l.action, "resource_type": l.resource_type, "user_id": l.user_id, "created_at": l.created_at} for l in logs]
