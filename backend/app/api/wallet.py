"""
Wallet API - Balance, transactions, and top-up
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field
import uuid

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.wallet import (
    Wallet, WalletTransaction, TransactionType, TransactionStatus
)

router = APIRouter(prefix="/wallet", tags=["wallet"])


# Pydantic Schemas
class WalletBalanceResponse(BaseModel):
    balance: float
    currency: str
    total_credits: float
    total_debits: float
    total_cashback: float
    total_referral_earnings: float

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: int
    transaction_id: str
    type: str
    status: str
    amount: float
    balance_before: float
    balance_after: float
    description: str
    reference_type: Optional[str]
    reference_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class TopUpRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10000, description="Amount to add (AED)")


class ApplyWalletRequest(BaseModel):
    booking_id: int
    amount: float = Field(..., gt=0, description="Amount to apply from wallet")


class WalletResponse(BaseModel):
    success: bool
    message: str
    balance: float
    transaction_id: Optional[str] = None


# Helper Functions
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


def create_transaction(
    db: Session,
    wallet: Wallet,
    type: TransactionType,
    amount: Decimal,
    description: str,
    reference_type: str = None,
    reference_id: str = None
) -> WalletTransaction:
    """Create a wallet transaction and update balance."""
    balance_before = wallet.balance

    # Calculate new balance
    if type in [TransactionType.CREDIT, TransactionType.CASHBACK, TransactionType.REFERRAL,
                TransactionType.REFUND, TransactionType.PROMO, TransactionType.TOPUP]:
        wallet.balance += amount
        wallet.total_credits += amount

        # Update specific totals
        if type == TransactionType.CASHBACK:
            wallet.total_cashback += amount
        elif type == TransactionType.REFERRAL:
            wallet.total_referral_earnings += amount
    else:  # DEBIT, WITHDRAWAL
        if wallet.balance < amount:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        wallet.balance -= amount
        wallet.total_debits += amount

    balance_after = wallet.balance

    # Create transaction record
    transaction = WalletTransaction(
        wallet_id=wallet.id,
        transaction_id=str(uuid.uuid4()),
        type=type,
        status=TransactionStatus.COMPLETED,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        description=description,
        reference_type=reference_type,
        reference_id=reference_id,
        completed_at=datetime.utcnow()
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return transaction


# API Endpoints
@router.get("/balance", response_model=WalletBalanceResponse)
def get_wallet_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's wallet balance and stats."""
    wallet = get_or_create_wallet(db, current_user.id)

    return WalletBalanceResponse(
        balance=float(wallet.balance),
        currency=wallet.currency,
        total_credits=float(wallet.total_credits),
        total_debits=float(wallet.total_debits),
        total_cashback=float(wallet.total_cashback),
        total_referral_earnings=float(wallet.total_referral_earnings)
    )


@router.get("/transactions", response_model=TransactionListResponse)
def get_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None, description="Filter by transaction type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's wallet transaction history."""
    wallet = get_or_create_wallet(db, current_user.id)

    # Build query
    query = db.query(WalletTransaction).filter(WalletTransaction.wallet_id == wallet.id)

    # Filter by type
    if type:
        try:
            transaction_type = TransactionType(type)
            query = query.filter(WalletTransaction.type == transaction_type)
        except ValueError:
            pass  # Invalid type, ignore filter

    # Get total count
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    transactions = query.order_by(WalletTransaction.created_at.desc())\
        .offset(offset).limit(page_size).all()

    return TransactionListResponse(
        transactions=[
            TransactionResponse(
                id=t.id,
                transaction_id=t.transaction_id,
                type=t.type.value,
                status=t.status.value,
                amount=float(t.amount),
                balance_before=float(t.balance_before),
                balance_after=float(t.balance_after),
                description=t.description,
                reference_type=t.reference_type,
                reference_id=t.reference_id,
                created_at=t.created_at
            )
            for t in transactions
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(transactions)) < total
    )


@router.post("/topup", response_model=WalletResponse)
def topup_wallet(
    request: TopUpRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add funds to wallet (mock for testing).
    In production, this would integrate with payment gateway.
    """
    wallet = get_or_create_wallet(db, current_user.id)

    try:
        transaction = create_transaction(
            db=db,
            wallet=wallet,
            type=TransactionType.TOPUP,
            amount=Decimal(str(request.amount)),
            description=f"Wallet top-up of AED {request.amount}",
            reference_type="topup",
            reference_id=str(uuid.uuid4())
        )

        return WalletResponse(
            success=True,
            message=f"Successfully added AED {request.amount} to your wallet",
            balance=float(wallet.balance),
            transaction_id=transaction.transaction_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/apply", response_model=WalletResponse)
def apply_wallet_to_booking(
    request: ApplyWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply wallet balance to a booking."""
    wallet = get_or_create_wallet(db, current_user.id)

    if wallet.balance < Decimal(str(request.amount)):
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: AED {wallet.balance}"
        )

    try:
        transaction = create_transaction(
            db=db,
            wallet=wallet,
            type=TransactionType.DEBIT,
            amount=Decimal(str(request.amount)),
            description=f"Payment for booking #{request.booking_id}",
            reference_type="booking",
            reference_id=str(request.booking_id)
        )

        return WalletResponse(
            success=True,
            message=f"Applied AED {request.amount} from wallet",
            balance=float(wallet.balance),
            transaction_id=transaction.transaction_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cashback")
def add_cashback(
    booking_id: int,
    amount: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add cashback to wallet (called internally after booking completion).
    In production, this would be triggered by booking completion webhook.
    """
    wallet = get_or_create_wallet(db, current_user.id)

    transaction = create_transaction(
        db=db,
        wallet=wallet,
        type=TransactionType.CASHBACK,
        amount=Decimal(str(amount)),
        description=f"Cashback from booking #{booking_id}",
        reference_type="booking",
        reference_id=str(booking_id)
    )

    return {
        "success": True,
        "message": f"Added AED {amount} cashback",
        "balance": float(wallet.balance),
        "transaction_id": transaction.transaction_id
    }


@router.get("/summary")
def get_wallet_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get wallet summary with recent transactions."""
    wallet = get_or_create_wallet(db, current_user.id)

    # Get recent transactions (last 5)
    recent_transactions = db.query(WalletTransaction)\
        .filter(WalletTransaction.wallet_id == wallet.id)\
        .order_by(WalletTransaction.created_at.desc())\
        .limit(5).all()

    # Get monthly stats
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    monthly_credits = db.query(func.sum(WalletTransaction.amount))\
        .filter(
            WalletTransaction.wallet_id == wallet.id,
            WalletTransaction.type.in_([
                TransactionType.CREDIT, TransactionType.CASHBACK,
                TransactionType.REFERRAL, TransactionType.TOPUP
            ]),
            WalletTransaction.created_at >= thirty_days_ago
        ).scalar() or 0

    monthly_debits = db.query(func.sum(WalletTransaction.amount))\
        .filter(
            WalletTransaction.wallet_id == wallet.id,
            WalletTransaction.type == TransactionType.DEBIT,
            WalletTransaction.created_at >= thirty_days_ago
        ).scalar() or 0

    return {
        "balance": float(wallet.balance),
        "currency": wallet.currency,
        "monthly_credits": float(monthly_credits),
        "monthly_debits": float(monthly_debits),
        "total_cashback": float(wallet.total_cashback),
        "total_referral_earnings": float(wallet.total_referral_earnings),
        "recent_transactions": [
            {
                "id": t.id,
                "type": t.type.value,
                "amount": float(t.amount),
                "description": t.description,
                "created_at": t.created_at.isoformat()
            }
            for t in recent_transactions
        ]
    }
