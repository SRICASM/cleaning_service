from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
import jwt
import bcrypt
import secrets
from app.config import settings


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def create_access_token(
    user_id: int,
    email: str,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )
    
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: int) -> Tuple[str, datetime]:
    """Create a refresh token."""
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    
    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": secrets.token_urlsafe(32)  # Unique token ID
    }
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return token, expires_at


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def generate_verification_token() -> str:
    """Generate a random token for email verification or password reset."""
    return secrets.token_urlsafe(32)


def generate_booking_number() -> str:
    """Generate a unique booking number."""
    timestamp = datetime.now().strftime("%y%m%d")
    random_part = secrets.token_hex(3).upper()
    return f"BH{timestamp}{random_part}"


def generate_invoice_number() -> str:
    """Generate a unique invoice number."""
    timestamp = datetime.now().strftime("%Y%m")
    random_part = secrets.token_hex(2).upper()
    return f"INV-{timestamp}-{random_part}"


def generate_subscription_number() -> str:
    """Generate a unique subscription number."""
    timestamp = datetime.now().strftime("%y%m")
    random_part = secrets.token_hex(2).upper()
    return f"SUB{timestamp}{random_part}"
