"""
Cache Service

Provides caching abstraction with optional Redis backend.
Falls back to in-memory cache if Redis is not available.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import json
import logging

logger = logging.getLogger(__name__)

# Try to import Redis, fall back to in-memory if not available
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not installed, using in-memory cache")


class InMemoryCache:
    """Simple in-memory cache for development/fallback."""
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._expiry: Dict[str, float] = {}
    
    async def get(self, key: str) -> Optional[str]:
        """Get a value from cache."""
        if key in self._cache:
            if key in self._expiry:
                if datetime.now(timezone.utc).timestamp() > self._expiry[key]:
                    del self._cache[key]
                    del self._expiry[key]
                    return None
            return self._cache[key]
        return None
    
    async def set(self, key: str, value: str, ttl: int = None) -> None:
        """Set a value in cache."""
        self._cache[key] = value
        if ttl:
            self._expiry[key] = datetime.now(timezone.utc).timestamp() + ttl
    
    async def delete(self, key: str) -> None:
        """Delete a value from cache."""
        self._cache.pop(key, None)
        self._expiry.pop(key, None)
    
    async def hget(self, name: str, key: str) -> Optional[str]:
        """Get a hash field."""
        hash_data = self._cache.get(name, {})
        return hash_data.get(key)
    
    async def hset(self, name: str, key: str, value: str) -> None:
        """Set a hash field."""
        if name not in self._cache:
            self._cache[name] = {}
        self._cache[name][key] = value
    
    async def hgetall(self, name: str) -> Dict[str, str]:
        """Get all hash fields."""
        return self._cache.get(name, {})
    
    async def hincrby(self, name: str, key: str, amount: int = 1) -> int:
        """Increment a hash field."""
        if name not in self._cache:
            self._cache[name] = {}
        current = int(self._cache[name].get(key, 0))
        new_value = current + amount
        self._cache[name][key] = str(new_value)
        return new_value
    
    async def zadd(self, name: str, mapping: Dict[str, float]) -> None:
        """Add to sorted set."""
        if name not in self._cache:
            self._cache[name] = {}
        self._cache[name].update(mapping)
    
    async def zrange(self, name: str, start: int, end: int, withscores: bool = False) -> List:
        """Get sorted set range."""
        data = self._cache.get(name, {})
        sorted_items = sorted(data.items(), key=lambda x: x[1])
        if end == -1:
            end = len(sorted_items)
        items = sorted_items[start:end+1]
        if withscores:
            return items
        return [item[0] for item in items]


class CacheService:
    """
    Cache service with Redis backend or in-memory fallback.
    
    Usage:
        cache = CacheService()
        await cache.connect()
        
        # Simple key-value
        await cache.set("key", "value", ttl=60)
        value = await cache.get("key")
        
        # Cleaner status
        await cache.set_cleaner_status(cleaner_id, "available")
        status = await cache.get_cleaner_status(cleaner_id)
        
        # Dashboard stats
        await cache.update_dashboard_stat("active_jobs", delta=1)
        stats = await cache.get_dashboard_stats()
    """
    
    _instance: Optional['CacheService'] = None
    
    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._redis_client = None
        self._fallback_cache = InMemoryCache()
        self._using_redis = False
        self._initialized = True
    
    async def connect(self, redis_url: str = "redis://localhost:6379") -> bool:
        """Connect to Redis if available."""
        if not REDIS_AVAILABLE:
            logger.info("Using in-memory cache (Redis not installed)")
            return False
        
        try:
            self._redis_client = redis.from_url(redis_url, decode_responses=True)
            await self._redis_client.ping()
            self._using_redis = True
            logger.info("Connected to Redis")
            return True
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}, using in-memory cache")
            self._using_redis = False
            return False
    
    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
            self._using_redis = False
    
    @property
    def client(self):
        """Get the cache client (Redis or fallback)."""
        if self._using_redis and self._redis_client:
            return self._redis_client
        return self._fallback_cache
    
    # ============ Basic Operations ============
    
    async def get(self, key: str) -> Optional[str]:
        """Get a value from cache."""
        return await self.client.get(key)
    
    async def set(self, key: str, value: str, ttl: int = None) -> None:
        """Set a value in cache with optional TTL."""
        if self._using_redis:
            if ttl:
                await self.client.setex(key, ttl, value)
            else:
                await self.client.set(key, value)
        else:
            await self.client.set(key, value, ttl)
    
    async def delete(self, key: str) -> None:
        """Delete a value from cache."""
        await self.client.delete(key)
    
    # ============ Cleaner Status Cache ============
    
    async def set_cleaner_status(
        self, 
        cleaner_id: int, 
        status: str, 
        ttl: int = 30
    ) -> None:
        """Cache cleaner status with 30 second TTL."""
        key = f"cleaner:status:{cleaner_id}"
        await self.set(key, status, ttl)
    
    async def get_cleaner_status(self, cleaner_id: int) -> Optional[str]:
        """Get cached cleaner status."""
        key = f"cleaner:status:{cleaner_id}"
        return await self.get(key)
    
    async def invalidate_cleaner_status(self, cleaner_id: int) -> None:
        """Invalidate cleaner status cache."""
        key = f"cleaner:status:{cleaner_id}"
        await self.delete(key)
    
    # ============ Dashboard Stats Cache ============
    
    DASHBOARD_STATS_KEY = "dashboard:stats"
    
    async def get_dashboard_stats(self) -> Dict[str, int]:
        """Get cached dashboard statistics."""
        data = await self.client.hgetall(self.DASHBOARD_STATS_KEY)
        return {k: int(v) for k, v in data.items()} if data else {}
    
    async def set_dashboard_stats(self, stats: Dict[str, int]) -> None:
        """Set all dashboard statistics."""
        for key, value in stats.items():
            await self.client.hset(self.DASHBOARD_STATS_KEY, key, str(value))
    
    async def update_dashboard_stat(self, field: str, delta: int = 1) -> int:
        """Increment/decrement a dashboard stat."""
        return await self.client.hincrby(self.DASHBOARD_STATS_KEY, field, delta)
    
    # ============ Recent Jobs Cache ============
    
    async def add_recent_job(
        self, 
        region_id: int, 
        job_id: int, 
        timestamp: float
    ) -> None:
        """Add job to recent jobs sorted set."""
        key = f"recent_jobs:{region_id}"
        await self.client.zadd(key, {str(job_id): timestamp})
    
    async def get_recent_jobs(
        self, 
        region_id: int, 
        limit: int = 25
    ) -> List[str]:
        """Get recent jobs for a region."""
        key = f"recent_jobs:{region_id}"
        return await self.client.zrange(key, 0, limit - 1)


# Global cache service instance
cache_service = CacheService()
