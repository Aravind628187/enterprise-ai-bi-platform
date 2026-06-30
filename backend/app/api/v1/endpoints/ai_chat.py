from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Dataset, ChatSession
from app.schemas.schemas import ChatCreate, ChatResponse
from app.ml.ai_engine import ai_engine

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(
    chat_in: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dataset = None
    file_path = None
    file_type = None

    if chat_in.dataset_id:
        result = await db.execute(
            select(Dataset).where(Dataset.id == chat_in.dataset_id, Dataset.owner_id == current_user.id)
        )
        dataset = result.scalar_one_or_none()
        if dataset:
            file_path = dataset.file_path
            file_type = dataset.file_type

    # Get or create session
    session = None
    if chat_in.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == chat_in.session_id))
        session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            dataset_id=chat_in.dataset_id,
            messages=[],
            title=chat_in.message[:50],
        )
        db.add(session)

    history = session.messages or []
    history.append({"role": "user", "content": chat_in.message})

    result = await ai_engine.chat_with_dataset(chat_in.message, file_path, file_type, history[:-1])

    history.append({"role": "assistant", "content": result["message"]})
    session.messages = history
    db.add(session)
    await db.commit()

    return ChatResponse(
        session_id=session.id,
        message=result["message"],
        charts=result.get("charts", []),
    )


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).limit(20)
    )
    sessions = result.scalars().all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at, "message_count": len(s.messages or [])} for s in sessions]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"id": session.id, "title": session.title, "messages": session.messages, "dataset_id": session.dataset_id}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted"}
