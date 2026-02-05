"""
Referral API - Code generation, application, and stats
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field
import random
import string

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.wallet import (
    Wallet, WalletTransaction, Referral, ReferralCode,
    TransactionType, TransactionStatus, ReferralStatus
)

router = APIRouter(prefix="/referrals", tags=["referrals"])

# Constants
REFERRAL_REWARD_AMOUNT = Decimal("50.00")  # AED 50 for referrer
REFEREE_BONUS_AMOUNT = Decimal("25.00")    # AED 25 for new user


# Pydantic Schemas
class ReferralCodeResponse(BaseModel):
    code: str
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    total_earnings: float
    share_message: str
    share_url: str

    class Config:
        from_attributes = True


class ReferralStatsResponse(BaseModel):
    total_referrals: int
    successful_referrals: int
    pending_referrals: int
    total_earnings: float
    referrals: List[dict]


class ApplyReferralRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=10, description="Referral code to apply")


class ApplyReferralResponse(BaseModel):
    success: bool
    message: str
    bonus_amount: float = 0


class ReferralListItem(BaseModel):
    id: int
    referred_name: str
    referred_email: str
    status: str
    reward_amount: float
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# Helper Functions
def generate_referral_code(user_id: int) -> str:
    """Generate a unique referral code for user."""
    # Use first 3 chars from user_id hash + 5 random alphanumeric
    prefix = f"CUC"  # CleanUpCrew
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{prefix}{suffix}"


def get_or_create_referral_code(db: Session, user_id: int) -> ReferralCode:
    """Get existing referral code or create new one for user."""
    referral_code = db.query(ReferralCode).filter(ReferralCode.user_id == user_id).first()

    if not referral_code:
        # Generate unique code
        code = generate_referral_code(user_id)

        # Ensure uniqueness
        while db.query(ReferralCode).filter(ReferralCode.code == code).first():
            code = generate_referral_code(user_id)

        referral_code = ReferralCode(
            user_id=user_id,
            code=code,
            is_active=True
        )
        db.add(referral_code)
        db.commit()
        db.refresh(referral_code)

    return referral_code


def get_or_create_wallet(db: Session, user_id: int) -> Wallet:
    """Get existing wallet or create new one for user."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()

    if not wallet:
        wallet = Wallet(
            user_id=user_id,
            balance=Decimal("0.00"),
            currency="AED"
        )
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    return wallet


def add_referral_reward(db: Session, user_id: int, amount: Decimal, description: str, referral_id: int):
    """Add referral reward to user's wallet."""
    wallet = get_or_create_wallet(db, user_id)

    balance_before = wallet.balance
    wallet.balance += amount
    wallet.total_credits += amount
    wallet.total_referral_earnings += amount

    # Create transaction
    import uuid
    transaction = WalletTransaction(
        wallet_id=wallet.id,
        transaction_id=str(uuid.uuid4()),
        type=TransactionType.REFERRAL,
        status=TransactionStatus.COMPLETED,
        amount=amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=description,
        reference_type="referral",
        reference_id=str(referral_id),
        completed_at=datetime.utcnow()
    )

    db.add(transaction)
    db.commit()


# API Endpoints
@router.get("/code", response_model=ReferralCodeResponse)
def get_referral_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's referral code and stats."""
    referral_code = get_or_create_referral_code(db, current_user.id)

    # Get referral stats
    total_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id
    ).count()

    successful_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.COMPLETED
    ).count()

    pending_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.PENDING
    ).count()

    total_earnings = db.query(func.sum(Referral.referrer_reward)).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.COMPLETED
    ).scalar() or 0

    # Generate share message
    share_message = f"Join CleanUpCrew and get AED {REFEREE_BONUS_AMOUNT} off your first booking! Use my code: {referral_code.code}"
    share_url = f"https://cleanupcrew.ae/register?ref={referral_code.code}"

    return ReferralCodeResponse(
        code=referral_code.code,
        total_referrals=total_referrals,
        successful_referrals=successful_referrals,
        pending_referrals=pending_referrals,
        total_earnings=float(total_earnings),
        share_message=share_message,
        share_url=share_url
    )


@router.post("/apply", response_model=ApplyReferralResponse)
def apply_referral_code(
    request: ApplyReferralRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply a referral code (for new users)."""
    code = request.code.upper().strip()

    # Check if user already used a referral code
    existing_referral = db.query(Referral).filter(
        Referral.referred_id == current_user.id
    ).first()

    if existing_referral:
        raise HTTPException(
            status_code=400,
            detail="You have already used a referral code"
        )

    # Find the referral code
    referral_code = db.query(ReferralCode).filter(
        ReferralCode.code == code,
        ReferralCode.is_active == True
    ).first()

    if not referral_code:
        raise HTTPException(
            status_code=404,
            detail="Invalid or expired referral code"
        )

    # Can't use own code
    if referral_code.user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot use your own referral code"
        )

    # Create referral record with 30-day expiry
    referral = Referral(
        referrer_id=referral_code.user_id,
        referred_id=current_user.id,
        referral_code=code,
        referral_code_id=referral_code.id,
        status=ReferralStatus.PENDING,
        referrer_reward=REFERRAL_REWARD_AMOUNT,
        referred_bonus=REFEREE_BONUS_AMOUNT,
        expires_at=datetime.utcnow() + timedelta(days=30)  # Referral must be completed within 30 days
    )

    db.add(referral)

    # Update referral code usage count
    referral_code.usage_count += 1

    # Give bonus to new user immediately
    add_referral_reward(
        db=db,
        user_id=current_user.id,
        amount=REFEREE_BONUS_AMOUNT,
        description=f"Welcome bonus from referral code {code}",
        referral_id=referral.id if referral.id else 0
    )

    db.commit()
    db.refresh(referral)

    return ApplyReferralResponse(
        success=True,
        message=f"Referral code applied! AED {REFEREE_BONUS_AMOUNT} has been added to your wallet.",
        bonus_amount=float(REFEREE_BONUS_AMOUNT)
    )


@router.post("/complete/{referral_id}")
def complete_referral(
    referral_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a referral as completed (called after referred user's first booking).
    In production, this would be triggered automatically.
    """
    referral = db.query(Referral).filter(
        Referral.id == referral_id,
        Referral.status == ReferralStatus.PENDING
    ).first()

    if not referral:
        raise HTTPException(
            status_code=404,
            detail="Referral not found or already completed"
        )

    # Update referral status
    referral.status = ReferralStatus.COMPLETED
    referral.completed_at = datetime.utcnow()

    # Reward the referrer
    add_referral_reward(
        db=db,
        user_id=referral.referrer_id,
        amount=REFERRAL_REWARD_AMOUNT,
        description=f"Referral reward - friend completed first booking",
        referral_id=referral.id
    )

    db.commit()

    return {
        "success": True,
        "message": f"Referral completed! Referrer earned AED {REFERRAL_REWARD_AMOUNT}"
    }


@router.get("/stats", response_model=ReferralStatsResponse)
def get_referral_stats(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed referral statistics."""
    # Get stats
    total_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id
    ).count()

    successful_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.COMPLETED
    ).count()

    pending_referrals = db.query(Referral).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.PENDING
    ).count()

    total_earnings = db.query(func.sum(Referral.referrer_reward)).filter(
        Referral.referrer_id == current_user.id,
        Referral.status == ReferralStatus.COMPLETED
    ).scalar() or 0

    # Get referral list with user details
    offset = (page - 1) * page_size
    referrals = db.query(Referral, User).join(
        User, User.id == Referral.referred_id
    ).filter(
        Referral.referrer_id == current_user.id
    ).order_by(Referral.created_at.desc()).offset(offset).limit(page_size).all()

    referral_list = []
    for referral, referred_user in referrals:
        # Mask email for privacy
        email_parts = referred_user.email.split('@')
        masked_email = f"{email_parts[0][:2]}***@{email_parts[1]}" if len(email_parts) == 2 else "***"

        referral_list.append({
            "id": referral.id,
            "referred_name": referred_user.full_name or "User",
            "referred_email": masked_email,
            "status": referral.status.value,
            "reward_amount": float(referral.referrer_reward) if referral.status == ReferralStatus.COMPLETED else 0,
            "created_at": referral.created_at.isoformat(),
            "completed_at": referral.completed_at.isoformat() if referral.completed_at else None
        })

    return ReferralStatsResponse(
        total_referrals=total_referrals,
        successful_referrals=successful_referrals,
        pending_referrals=pending_referrals,
        total_earnings=float(total_earnings),
        referrals=referral_list
    )


@router.get("/leaderboard")
def get_referral_leaderboard(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Get top referrers leaderboard."""
    # Get top referrers by successful referrals
    leaderboard = db.query(
        User.id,
        User.full_name,
        func.count(Referral.id).label('referral_count'),
        func.sum(Referral.referrer_reward).label('total_earnings')
    ).join(
        Referral, Referral.referrer_id == User.id
    ).filter(
        Referral.status == ReferralStatus.COMPLETED
    ).group_by(
        User.id, User.full_name
    ).order_by(
        func.count(Referral.id).desc()
    ).limit(limit).all()

    return {
        "leaderboard": [
            {
                "rank": idx + 1,
                "name": entry.full_name or f"User #{entry.id}",
                "referrals": entry.referral_count,
                "earnings": float(entry.total_earnings or 0)
            }
            for idx, entry in enumerate(leaderboard)
        ]
    }
