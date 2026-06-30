from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Notification
from app.schemas.schemas import NotificationResponse

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Marked as read"}


@router.patch("/mark-all-read")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All marked as read"}


@router.get("/count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    return {"count": result.scalar() or 0}
