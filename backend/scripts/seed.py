"""Seed the database with admin user and sample data."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.core.database import Base
from app.core.security import get_password_hash
from app.models.models import User, UserRole, Notification
import uuid


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Check if admin exists
        result = await session.execute(select(User).where(User.email == "admin@enterprise.com"))
        existing = result.scalar_one_or_none()

        if not existing:
            admin = User(
                id=str(uuid.uuid4()),
                email="admin@enterprise.com",
                username="admin",
                full_name="Platform Admin",
                hashed_password=get_password_hash("admin123!"),
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            session.add(admin)

            analyst = User(
                id=str(uuid.uuid4()),
                email="analyst@enterprise.com",
                username="analyst",
                full_name="Data Analyst",
                hashed_password=get_password_hash("analyst123!"),
                role=UserRole.ANALYST,
                is_active=True,
                is_verified=True,
            )
            session.add(analyst)

            viewer = User(
                id=str(uuid.uuid4()),
                email="viewer@enterprise.com",
                username="viewer",
                full_name="Report Viewer",
                hashed_password=get_password_hash("viewer123!"),
                role=UserRole.VIEWER,
                is_active=True,
                is_verified=True,
            )
            session.add(viewer)
            await session.flush()

            # Welcome notification
            notif = Notification(
                id=str(uuid.uuid4()),
                title="Welcome to Enterprise AI BI Platform!",
                message="Your account has been set up. Start by uploading a dataset.",
                notification_type="success",
                user_id=admin.id,
            )
            session.add(notif)

            await session.commit()
            print("✅ Seed complete: admin@enterprise.com / admin123!")
        else:
            print("ℹ️  Seed already applied.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
