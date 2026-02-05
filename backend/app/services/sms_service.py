"""
SMS Service

Abstracts SMS sending for OTP delivery.
Supports multiple providers with fallback.

For development: Uses mock implementation that logs SMS.
For production: Configure Twilio or other provider.
"""
from abc import ABC, abstractmethod
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)


class SMSProvider(ABC):
    """Abstract base class for SMS providers."""
    
    @abstractmethod
    async def send(self, phone_number: str, message: str) -> bool:
        """Send an SMS message."""
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """Get provider name for logging."""
        pass


class MockSMSProvider(SMSProvider):
    """
    Mock SMS provider for development.
    Logs SMS messages instead of sending.
    """
    
    async def send(self, phone_number: str, message: str) -> bool:
        """Log SMS instead of sending."""
        logger.info(f"[MOCK SMS] To: {phone_number}")
        logger.info(f"[MOCK SMS] Message: {message}")
        print(f"\n{'='*50}")
        print(f"📱 SMS to {phone_number}")
        print(f"📝 {message}")
        print(f"{'='*50}\n")
        return True
    
    def get_provider_name(self) -> str:
        return "MockSMS"


class TwilioSMSProvider(SMSProvider):
    """
    Twilio SMS provider for production.
    
    Requires environment variables:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_PHONE_NUMBER
    """
    
    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_PHONE_NUMBER")
        self.client = None
        
        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self.client = Client(self.account_sid, self.auth_token)
                logger.info("Twilio SMS provider initialized")
            except ImportError:
                logger.warning("Twilio package not installed")
    
    async def send(self, phone_number: str, message: str) -> bool:
        """Send SMS via Twilio."""
        if not self.client:
            logger.error("Twilio client not initialized")
            return False
        
        try:
            result = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=phone_number
            )
            logger.info(f"Twilio SMS sent: {result.sid}")
            return True
        except Exception as e:
            logger.error(f"Twilio SMS failed: {e}")
            return False
    
    def get_provider_name(self) -> str:
        return "Twilio"


class SMSService:
    """
    SMS service with provider abstraction and fallback.
    """
    
    # SMS Templates
    TEMPLATES = {
        "otp": "Your verification code is: {otp}. Valid for 5 minutes. Do not share this code.",
        "welcome": "Welcome to our team! Your Employee ID is {employee_id}. You can now login using this phone number.",
        "suspended": "Your account has been suspended. Please contact admin for assistance.",
        "reactivated": "Your account has been reactivated. You can now login.",
    }
    
    def __init__(self, use_mock: bool = True):
        """
        Initialize SMS service.
        
        Args:
            use_mock: Use mock provider (True for development)
        """
        self.primary_provider: SMSProvider
        self.fallback_provider: Optional[SMSProvider] = None
        
        if use_mock or os.getenv("SMS_MOCK", "true").lower() == "true":
            self.primary_provider = MockSMSProvider()
        else:
            # Try Twilio
            twilio = TwilioSMSProvider()
            if twilio.client:
                self.primary_provider = twilio
            else:
                logger.warning("No SMS provider configured, using mock")
                self.primary_provider = MockSMSProvider()
    
    async def send_otp(self, phone_number: str, otp: str) -> bool:
        """
        Send OTP SMS.
        
        Args:
            phone_number: Recipient phone number
            otp: The 6-digit OTP
            
        Returns:
            True if sent successfully
        """
        message = self.TEMPLATES["otp"].format(otp=otp)
        return await self._send(phone_number, message)
    
    async def send_welcome(self, phone_number: str, employee_id: str) -> bool:
        """Send welcome SMS to new employee."""
        message = self.TEMPLATES["welcome"].format(employee_id=employee_id)
        return await self._send(phone_number, message)
    
    async def send_account_suspended(self, phone_number: str) -> bool:
        """Send account suspended notification."""
        return await self._send(phone_number, self.TEMPLATES["suspended"])
    
    async def send_account_reactivated(self, phone_number: str) -> bool:
        """Send account reactivated notification."""
        return await self._send(phone_number, self.TEMPLATES["reactivated"])
    
    async def send_custom(self, phone_number: str, message: str) -> bool:
        """Send custom SMS message."""
        return await self._send(phone_number, message)
    
    async def _send(self, phone_number: str, message: str) -> bool:
        """
        Send SMS with fallback.
        """
        # Try primary provider
        try:
            success = await self.primary_provider.send(phone_number, message)
            if success:
                return True
        except Exception as e:
            logger.error(f"Primary SMS failed: {e}")
        
        # Try fallback if available
        if self.fallback_provider:
            try:
                return await self.fallback_provider.send(phone_number, message)
            except Exception as e:
                logger.error(f"Fallback SMS failed: {e}")
        
        return False
    
    def get_provider_info(self) -> dict:
        """Get current provider information."""
        return {
            "primary": self.primary_provider.get_provider_name(),
            "fallback": self.fallback_provider.get_provider_name() if self.fallback_provider else None
        }


# Global SMS service instance
sms_service = SMSService(use_mock=True)
