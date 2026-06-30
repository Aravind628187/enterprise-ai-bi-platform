import pytest
import uuid

from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.models import User, UserRole

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    app.dependency_overrides[get_db] = override_get_db

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client


@pytest.fixture
async def test_user(setup_db):
    async with TestSessionLocal() as session:

        # remove previous users
        await session.execute(delete(User))
        await session.commit()

        uid = str(uuid.uuid4())

        user = User(
            id=uid,
            email=f"{uid}@example.com",
            username=f"user_{uid}",
            full_name="Test User",
            hashed_password=get_password_hash("testpass123"),
            role=UserRole.ANALYST,
            is_active=True,
            is_verified=True,
        )

        session.add(user)
        await session.commit()
        await session.refresh(user)

        return user


@pytest.mark.anyio
async def test_health(client):
    r = await client.get("/health")

    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


@pytest.mark.anyio
async def test_register(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "username": "newuser",
            "full_name": "New User",
            "password": "securepass123",
        },
    )

    assert r.status_code == 201
    assert r.json()["email"] == "new@example.com"


@pytest.mark.anyio
async def test_login(client, test_user):
    r = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "testpass123",
        },
    )

    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.anyio
async def test_login_wrong_password(client, test_user):
    r = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "wrongpassword",
        },
    )

    assert r.status_code == 401


@pytest.mark.anyio
async def test_get_me(client, test_user):

    login = await client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user.email,
            "password": "testpass123",
        },
    )

    assert login.status_code == 200

    token = login.json()["access_token"]

    r = await client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert r.status_code == 200
    assert r.json()["email"] == test_user.email


@pytest.mark.anyio
async def test_unauthorized(client):
    r = await client.get("/api/v1/auth/me")

    assert r.status_code == 401