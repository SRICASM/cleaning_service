"""
OTP Service

Handles OTP generation, storage, and verification for phone-based authentication.

Features:
- 6-digit numeric OTP
- 5-minute expiry
- Rate limiting (5 requests/hour)
- Resend cooldown (60 seconds)
- Max 3 verification attempts
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any
import hashlib
import secrets
import uuid
import logging

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models.employee import OTPRequest
from app.services.cache import cache_service

logger = logging.getLogger(__name__)


class OTPError(Exception):
    """Base exception for OTP errors."""
    pass


class RateLimitExceeded(OTPError):
    """Rate limit exceeded."""
    pass


class OTPExpired(OTPError):
    """OTP has expired."""
    pass


class OTPInvalid(OTPError):
    """OTP is invalid."""
    pass


class MaxAttemptsExceeded(OTPError):
    """Maximum verification attempts exceeded."""
    pass


class CooldownActive(OTPError):
    """Resend cooldown is active."""
    pass


class OTPService:
    """
    Service for OTP generation and verification.
    """
    
    # Configuration
    OTP_LENGTH = 6
    OTP_EXPIRY_SECONDS = 300  # 5 minutes
    MAX_ATTEMPTS = 3
    RESEND_COOLDOWN_SECONDS = 60
    RATE_LIMIT_REQUESTS = 5
    RATE_LIMIT_WINDOW_SECONDS = 3600  # 1 hour
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_otp(self) -> str:
        """Generate a random 6-digit OTP."""
        return ''.join(str(secrets.randbelow(10)) for _ in range(self.OTP_LENGTH))
    
    def hash_otp(self, otp: str, salt: str = "") -> str:
        """Hash OTP for secure storage."""
        return hashlib.sha256(f"{otp}{salt}".encode()).hexdigest()
    
    async def request_otp(
        self,
        phone_number: str,
        user_type: str
    ) -> Dict[str, Any]:
        """
        Request a new OTP for the given phone number.
        
        Args:
            phone_number: Phone number in +971XXXXXXXXX format
            user_type: EMPLOYEE or CUSTOMER
            
        Returns:
            Dict with otp_id, expires_at, can_resend_after
            
        Raises:
            RateLimitExceeded: If rate limit is hit
            CooldownActive: If resend cooldown is active
        """
        # Check rate limit
        await self._check_rate_limit(phone_number)
        
        # Check resend cooldown
        await self._check_cooldown(phone_number)
        
        # Generate OTP
        otp = self.generate_otp()
        otp_id = str(uuid.uuid4())
        
        # Calculate expiry
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=self.OTP_EXPIRY_SECONDS)
        can_resend_after = now + timedelta(seconds=self.RESEND_COOLDOWN_SECONDS)
        
        # Hash OTP for storage
        otp_hash = self.hash_otp(otp, otp_id)
        
        # Store in database for audit
        otp_request = OTPRequest(
            id=uuid.UUID(otp_id),
            phone_number=phone_number,
            user_type=user_type,
            otp_hash=otp_hash,
            attempts=0,
            expires_at=expires_at
        )
        self.db.add(otp_request)
        self.db.commit()
        
        # Store in cache for fast verification
        await cache_service.set(
            f"otp:{phone_number}:{otp_id}",
            f"{otp_hash}|{user_type}|0",  # hash|type|attempts
            ttl=self.OTP_EXPIRY_SECONDS
        )
        
        # Set resend cooldown
        await cache_service.set(
            f"otp_cooldown:{phone_number}",
            "1",
            ttl=self.RESEND_COOLDOWN_SECONDS
        )
        
        # Increment rate limit counter
        await self._increment_rate_limit(phone_number)
        
        logger.info(f"OTP requested for {phone_number[-4:].rjust(len(phone_number), '*')}")
        
        return {
            "otp_id": otp_id,
            "otp": otp,  # Return OTP for SMS sending (don't log!)
            "expires_at": expires_at.isoformat(),
            "can_resend_after": can_resend_after.isoformat()
        }
    
    async def verify_otp(
        self,
        phone_number: str,
        otp: str,
        otp_id: str,
        user_type: str
    ) -> bool:
        """
        Verify an OTP.
        
        Args:
            phone_number: Phone number
            otp: The 6-digit OTP to verify
            otp_id: The OTP request ID
            user_type: EMPLOYEE or CUSTOMER
            
        Returns:
            True if OTP is valid
            
        Raises:
            OTPExpired: If OTP has expired
            OTPInvalid: If OTP is wrong
            MaxAttemptsExceeded: If max attempts reached
        """
        # Try cache first
        cache_key = f"otp:{phone_number}:{otp_id}"
        cached = await cache_service.get(cache_key)
        
        # Get from database if not in cache
        otp_request = self.db.query(OTPRequest).filter(
            OTPRequest.id == uuid.UUID(otp_id),
            OTPRequest.phone_number == phone_number,
            OTPRequest.user_type == user_type,
            OTPRequest.verified == False
        ).first()
        
        if not otp_request:
            raise OTPInvalid("OTP request not found")
        
        # Check expiry
        if datetime.now(timezone.utc) > otp_request.expires_at:
            raise OTPExpired("OTP has expired")
        
        # Check attempts
        if otp_request.attempts >= self.MAX_ATTEMPTS:
            raise MaxAttemptsExceeded("Maximum verification attempts exceeded")
        
        # Increment attempt counter
        otp_request.attempts += 1
        self.db.commit()
        
        # Verify OTP
        expected_hash = self.hash_otp(otp, otp_id)
        
        if otp_request.otp_hash != expected_hash:
            remaining = self.MAX_ATTEMPTS - otp_request.attempts
            logger.warning(f"Invalid OTP attempt for {phone_number[-4:].rjust(len(phone_number), '*')}")
            raise OTPInvalid(f"Invalid OTP. {remaining} attempts remaining.")
        
        # Mark as verified
        otp_request.verified = True
        otp_request.verified_at = datetime.now(timezone.utc)
        self.db.commit()
        
        # Delete from cache
        await cache_service.delete(cache_key)
        
        logger.info(f"OTP verified for {phone_number[-4:].rjust(len(phone_number), '*')}")
        return True
    
    async def resend_otp(
        self,
        phone_number: str,
        otp_id: str,
        user_type: str
    ) -> Dict[str, Any]:
        """
        Resend OTP (invalidates old OTP).
        """
        # Invalidate old OTP
        old_request = self.db.query(OTPRequest).filter(
            OTPRequest.id == uuid.UUID(otp_id)
        ).first()
        
        if old_request:
            old_request.verified = True  # Mark as used/invalid
            self.db.commit()
        
        # Delete from cache
        await cache_service.delete(f"otp:{phone_number}:{otp_id}")
        
        # Generate new OTP
        return await self.request_otp(phone_number, user_type)
    
    async def _check_rate_limit(self, phone_number: str) -> None:
        """Check if phone number has exceeded rate limit."""
        key = f"otp_rate:{phone_number}"
        count = await cache_service.get(key)
        
        if count and int(count) >= self.RATE_LIMIT_REQUESTS:
            raise RateLimitExceeded(
                "Too many OTP requests. Please try again later."
            )
    
    async def _increment_rate_limit(self, phone_number: str) -> None:
        """Increment rate limit counter."""
        key = f"otp_rate:{phone_number}"
        current = await cache_service.get(key)
        
        if current:
            # Note: In production with Redis, use INCR
            await cache_service.set(key, str(int(current) + 1), ttl=self.RATE_LIMIT_WINDOW_SECONDS)
        else:
            await cache_service.set(key, "1", ttl=self.RATE_LIMIT_WINDOW_SECONDS)
    
    async def _check_cooldown(self, phone_number: str) -> None:
        """Check if resend cooldown is active."""
        key = f"otp_cooldown:{phone_number}"
        if await cache_service.get(key):
            raise CooldownActive(
                f"Please wait {self.RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP."
            )
    
    def get_otp_status(self, otp_id: str) -> Optional[Dict[str, Any]]:
        """Get OTP request status (for debugging/admin)."""
        otp_request = self.db.query(OTPRequest).filter(
            OTPRequest.id == uuid.UUID(otp_id)
        ).first()
        
        if not otp_request:
            return None
        
        return {
            "otp_id": str(otp_request.id),
            "phone_number": otp_request.phone_number,
            "user_type": otp_request.user_type,
            "attempts": otp_request.attempts,
            "verified": otp_request.verified,
            "expired": datetime.now(timezone.utc) > otp_request.expires_at,
            "created_at": otp_request.created_at.isoformat(),
            "expires_at": otp_request.expires_at.isoformat()
        }
