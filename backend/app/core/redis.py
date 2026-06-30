import redis.asyncio as redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_cached(key: str):
    try:
        return await redis_client.get(key)
    except Exception:
        return None


async def set_cached(key: str, value: str, expire: int = 300):
    try:
        await redis_client.setex(key, expire, value)
    except Exception:
        pass


async def delete_cached(key: str):
    try:
        await redis_client.delete(key)
    except Exception:
        pass


async def cache_pattern_delete(pattern: str):
    try:
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass
