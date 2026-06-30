from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.core.deps import get_current_user
from app.models.models import User
from app.schemas.schemas import (
    UserCreate,
    UserResponse,
    Token,
    TokenRefresh,
    UserUpdate,
)

router = APIRouter()


# -------------------- Register -------------------- #
@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    result = await db.execute(
        select(User).where(User.username == user_in.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Username already taken",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True,
        is_verified=True,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


# -------------------- Login -------------------- #
@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    if not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Account disabled",
        )

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(last_login=datetime.utcnow())
    )

    await db.commit()

    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# -------------------- Refresh Token -------------------- #
@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_in: TokenRefresh,
    db: AsyncSession = Depends(get_db),
):
    user_id = verify_token(
        token_in.refresh_token,
        "refresh",
    )

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token",
        )

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# -------------------- Current User -------------------- #
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


# -------------------- Update Profile -------------------- #
@router.patch("/me", response_model=UserResponse)
async def update_me(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = updates.model_dump(exclude_none=True)

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return current_user


# -------------------- Change Password -------------------- #
@router.post("/change-password")
async def change_password(
    old_password: str,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(
        old_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Incorrect current password",
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password too short",
        )

    current_user.hashed_password = get_password_hash(
        new_password
    )

    db.add(current_user)
    await db.commit()

    return {
        "message": "Password changed successfully"
    }