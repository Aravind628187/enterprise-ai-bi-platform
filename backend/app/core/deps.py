from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_token
from app.models.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = verify_token(token, "access")
    if not user_id:
        raise credentials_exception
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


def require_roles(*roles: UserRole):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker


require_admin = require_roles(UserRole.ADMIN)
require_manager_or_above = require_roles(UserRole.ADMIN, UserRole.MANAGER)
require_analyst_or_above = require_roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST)
