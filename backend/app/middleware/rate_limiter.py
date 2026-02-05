"""
Rate Limiter Middleware

Token bucket rate limiting with in-memory or Redis backend.
"""
from datetime import datetime, timezone
from typing import Dict, Tuple, Optional, Callable
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import time
import logging

logger = logging.getLogger(__name__)


class RateLimitExceeded(HTTPException):
    """Rate limit exceeded exception."""
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(status_code=429, detail=detail)


class TokenBucket:
    """Simple token bucket rate limiter."""
    
    def __init__(self, rate: int, per: int):
        """
        Initialize token bucket.
        
        Args:
            rate: Number of tokens (requests) allowed
            per: Time window in seconds
        """
        self.rate = rate
        self.per = per
        self.tokens: Dict[str, float] = {}
        self.last_update: Dict[str, float] = {}
    
    def allow(self, key: str) -> Tuple[bool, int]:
        """
        Check if request is allowed.
        
        Returns:
            Tuple of (allowed: bool, remaining_tokens: int)
        """
        now = time.time()
        
        # Initialize if new key
        if key not in self.tokens:
            self.tokens[key] = self.rate
            self.last_update[key] = now
        
        # Refill tokens based on time elapsed
        elapsed = now - self.last_update[key]
        refill = elapsed * (self.rate / self.per)
        self.tokens[key] = min(self.rate, self.tokens[key] + refill)
        self.last_update[key] = now
        
        # Check if request is allowed
        if self.tokens[key] >= 1:
            self.tokens[key] -= 1
            return True, int(self.tokens[key])
        
        return False, 0
    
    def reset(self, key: str) -> None:
        """Reset tokens for a key."""
        self.tokens.pop(key, None)
        self.last_update.pop(key, None)


class RateLimiter:
    """
    Rate limiter with configurable limits per endpoint.
    """
    
    # Default rate limits: (requests, per_seconds)
    DEFAULT_LIMITS = {
        # Cleaner actions
        '/api/cleaner/jobs/*/start': (5, 60),     # 5 per minute
        '/api/cleaner/jobs/*/pause': (10, 300),   # 10 per 5 minutes
        '/api/cleaner/jobs/*/resume': (10, 300),
        '/api/cleaner/jobs/*/complete': (5, 60),
        '/api/cleaner/jobs/*/fail': (5, 60),
        '/api/cleaner/me/go-online': (10, 60),
        '/api/cleaner/me/go-offline': (10, 60),
        
        # Admin actions
        '/api/admin/jobs/*/assign': (30, 60),      # 30 per minute
        '/api/admin/stats/realtime': (60, 60),     # 60 per minute (1/sec)
        '/api/admin/cleaners/status': (60, 60),
        '/api/admin/alerts/delayed-jobs': (60, 60),
        
        # Auth
        '/api/auth/login': (5, 60),                # 5 per minute
        '/api/auth/register': (3, 60),             # 3 per minute
        
        # General API
        'default': (100, 60),                      # 100 per minute default
    }
    
    def __init__(self, limits: Dict[str, Tuple[int, int]] = None):
        self.limits = limits or self.DEFAULT_LIMITS
        self.buckets: Dict[str, TokenBucket] = {}
        
        # Create buckets for each limit
        for path, (rate, per) in self.limits.items():
            self.buckets[path] = TokenBucket(rate, per)
    
    def _match_path(self, request_path: str) -> str:
        """Match request path to a configured limit pattern."""
        # Exact match first
        if request_path in self.limits:
            return request_path
        
        # Pattern matching with wildcards
        for pattern in self.limits.keys():
            if pattern == 'default':
                continue
            
            # Simple wildcard matching
            if '*' in pattern:
                # Convert pattern to regex-like matching
                parts = pattern.split('*')
                if len(parts) == 2:
                    prefix, suffix = parts
                    if request_path.startswith(prefix) and request_path.endswith(suffix):
                        return pattern
        
        return 'default'
    
    def _get_key(self, request: Request, pattern: str) -> str:
        """Generate rate limit key from request."""
        # Use IP + user ID (if authenticated) + pattern
        client_ip = request.client.host if request.client else 'unknown'
        user_id = getattr(request.state, 'user_id', None)
        
        if user_id:
            return f"{pattern}:{user_id}"
        return f"{pattern}:{client_ip}"
    
    def check(self, request: Request) -> Tuple[bool, int, int, int]:
        """
        Check if request is within rate limits.
        
        Returns:
            Tuple of (allowed, remaining, limit, reset_time)
        """
        pattern = self._match_path(request.url.path)
        key = self._get_key(request, pattern)
        bucket = self.buckets.get(pattern, self.buckets['default'])
        
        allowed, remaining = bucket.allow(key)
        
        return allowed, remaining, bucket.rate, bucket.per
    
    def reset_user(self, user_id: int) -> None:
        """Reset all rate limits for a user."""
        for bucket in self.buckets.values():
            # Find and reset all keys for this user
            keys_to_reset = [k for k in bucket.tokens.keys() if k.endswith(f":{user_id}")]
            for key in keys_to_reset:
                bucket.reset(key)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for rate limiting.
    """
    
    def __init__(self, app, limiter: RateLimiter = None, enabled: bool = True):
        super().__init__(app)
        self.limiter = limiter or RateLimiter()
        self.enabled = enabled
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)
        
        # Skip rate limiting for certain paths
        skip_paths = ['/', '/docs', '/openapi.json', '/health']
        if request.url.path in skip_paths:
            return await call_next(request)
        
        # Check rate limit
        allowed, remaining, limit, window = self.limiter.check(request)
        
        if not allowed:
            logger.warning(f"Rate limit exceeded: {request.url.path}")
            raise RateLimitExceeded(
                detail=f"Rate limit exceeded. Try again in {window} seconds."
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers['X-RateLimit-Limit'] = str(limit)
        response.headers['X-RateLimit-Remaining'] = str(remaining)
        response.headers['X-RateLimit-Window'] = str(window)
        
        return response


# Global rate limiter instance
rate_limiter = RateLimiter()
