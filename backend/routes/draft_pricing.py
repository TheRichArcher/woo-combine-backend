"""
Draft Pricing & Payment Routes
Stripe-ready infrastructure for paid draft feature.

For testing: All drafts are FREE. Set DRAFT_PAYMENTS_ENABLED=true to require payment.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

# from typing import Optional  # unused
from datetime import datetime, timezone
from ..auth import get_current_user
from ..firestore_client import get_firestore_client
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/draft-payments", tags=["draft-payments"])

# Feature flag - set to True when ready to charge
PAYMENTS_ENABLED = os.getenv("DRAFT_PAYMENTS_ENABLED", "false").lower() == "true"

# Pricing tiers (based on number of coaches/teams)
PRICING_TIERS = [
    {
        "min_teams": 1,
        "max_teams": 1,
        "price_cents": 0,
        "name": "Solo",
        "stripe_price_id": None,
    },
    {
        "min_teams": 2,
        "max_teams": 5,
        "price_cents": 1999,
        "name": "Basic",
        "stripe_price_id": "price_draft_basic",
    },
    {
        "min_teams": 6,
        "max_teams": 10,
        "price_cents": 2999,
        "name": "Standard",
        "stripe_price_id": "price_draft_standard",
    },
    {
        "min_teams": 11,
        "max_teams": 15,
        "price_cents": 3499,
        "name": "Plus",
        "stripe_price_id": "price_draft_plus",
    },
    {
        "min_teams": 16,
        "max_teams": 999,
        "price_cents": 3999,
        "name": "Pro",
        "stripe_price_id": "price_draft_pro",
    },
]

# Free tier: drafts with ≤15 players are free (like OnlineDraft's "Micro Draft")
FREE_PLAYER_LIMIT = 15


def get_pricing_tier(num_teams: int) -> dict:
    """Get pricing tier based on number of teams."""
    for tier in PRICING_TIERS:
        if tier["min_teams"] <= num_teams <= tier["max_teams"]:
            return tier
    return PRICING_TIERS[-1]  # Default to highest tier


def is_draft_free(num_teams: int, num_players: int) -> bool:
    """Check if draft qualifies for free tier."""
    # Micro draft: ≤15 players = free
    if num_players <= FREE_PLAYER_LIMIT:
        return True
    # Solo draft: 1 team = free (practice mode)
    if num_teams <= 1:
        return True
    return False


class PricingResponse(BaseModel):
    draft_id: str
    num_teams: int
    num_players: int
    tier_name: str
    price_cents: int
    price_display: str
    is_free: bool
    requires_payment: bool
    payment_status: str  # "not_required" | "pending" | "paid" | "expired"


class CreateCheckoutRequest(BaseModel):
    draft_id: str
    success_url: str
    cancel_url: str


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.get("/pricing/{draft_id}")
async def get_draft_pricing(
    draft_id: str, user: dict = Depends(get_current_user)
) -> PricingResponse:
    """Get pricing info for a draft."""
    db = get_firestore_client()

    draft_doc = db.collection("drafts").document(draft_id).get()
    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = draft_doc.to_dict()

    # Count teams and players
    teams = list(
        db.collection("draft_teams").where("draft_id", "==", draft_id).stream()
    )
    num_teams = len(teams)

    # Get player count (from event or direct draft players)
    num_players = get_draft_player_count(db, draft)

    tier = get_pricing_tier(num_teams)
    is_free = is_draft_free(num_teams, num_players)

    # Check payment status
    payment_status = draft.get("payment_status", "not_required")
    if is_free or not PAYMENTS_ENABLED:
        payment_status = "not_required"

    return PricingResponse(
        draft_id=draft_id,
        num_teams=num_teams,
        num_players=num_players,
        tier_name=tier["name"],
        price_cents=0 if is_free else tier["price_cents"],
        price_display="Free" if is_free else f"${tier['price_cents'] / 100:.2f}",
        is_free=is_free,
        requires_payment=PAYMENTS_ENABLED and not is_free and payment_status != "paid",
        payment_status=payment_status,
    )


@router.post("/create-checkout")
async def create_checkout_session(
    request: CreateCheckoutRequest, user: dict = Depends(get_current_user)
) -> CheckoutResponse:
    """Create a Stripe checkout session for draft payment."""

    if not PAYMENTS_ENABLED:
        raise HTTPException(
            status_code=400, detail="Payments not enabled - drafts are free"
        )

    db = get_firestore_client()
    draft_doc = db.collection("drafts").document(request.draft_id).get()

    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = draft_doc.to_dict()

    # Verify user owns this draft
    if draft.get("created_by") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only draft creator can purchase")

    # Get pricing
    teams = list(
        db.collection("draft_teams").where("draft_id", "==", request.draft_id).stream()
    )
    num_teams = len(teams)
    # tier = get_pricing_tier(num_teams)  # TODO: uncomment when Stripe integration is added

    # Check if already paid
    if draft.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Draft already paid for")

    # TODO: Integrate actual Stripe
    # import stripe
    # stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    # session = stripe.checkout.Session.create(
    #     payment_method_types=["card"],
    #     line_items=[{
    #         "price": tier["stripe_price_id"],
    #         "quantity": 1,
    #     }],
    #     mode="payment",
    #     success_url=request.success_url + "?session_id={CHECKOUT_SESSION_ID}",
    #     cancel_url=request.cancel_url,
    #     metadata={
    #         "draft_id": request.draft_id,
    #         "user_id": user["uid"],
    #     }
    # )
    # return CheckoutResponse(checkout_url=session.url, session_id=session.id)

    # Placeholder response
    raise HTTPException(
        status_code=501,
        detail="Stripe integration pending. Set DRAFT_PAYMENTS_ENABLED=false for free access.",
    )


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""

    # TODO: Implement actual Stripe webhook handling
    # payload = await request.body()
    # sig_header = request.headers.get("stripe-signature")
    # endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    #
    # try:
    #     event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    # except ValueError:
    #     raise HTTPException(status_code=400, detail="Invalid payload")
    # except stripe.error.SignatureVerificationError:
    #     raise HTTPException(status_code=400, detail="Invalid signature")
    #
    # if event["type"] == "checkout.session.completed":
    #     session = event["data"]["object"]
    #     draft_id = session["metadata"]["draft_id"]
    #
    #     db = get_firestore_client()
    #     db.collection("drafts").document(draft_id).update({
    #         "payment_status": "paid",
    #         "payment_session_id": session["id"],
    #         "payment_amount_cents": session["amount_total"],
    #         "paid_at": datetime.now(timezone.utc).isoformat(),
    #         "payment_expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    #     })
    #
    # return {"status": "ok"}

    logger.info("Stripe webhook received (not processed - payments disabled)")
    return {"status": "ok", "processed": False}


@router.post("/bypass-payment/{draft_id}")
async def bypass_payment(draft_id: str, user: dict = Depends(get_current_user)):
    """
    DEV ONLY: Bypass payment for testing.
    In production, remove this endpoint or restrict to admin.
    """
    if PAYMENTS_ENABLED:
        raise HTTPException(
            status_code=403, detail="Cannot bypass when payments enabled"
        )

    db = get_firestore_client()
    draft_doc = db.collection("drafts").document(draft_id).get()

    if not draft_doc.exists:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = draft_doc.to_dict()
    if draft.get("created_by") != user["uid"]:
        raise HTTPException(status_code=403, detail="Only draft creator can bypass")

    db.collection("drafts").document(draft_id).update(
        {
            "payment_status": "bypassed",
            "payment_bypassed_at": datetime.now(timezone.utc).isoformat(),
            "payment_bypassed_by": user["uid"],
        }
    )

    return {"status": "ok", "message": "Payment bypassed for testing"}


def get_draft_player_count(db, draft_data: dict) -> int:
    """Get total player count for a draft (from event or direct players)."""
    count = 0

    # Count from event (combine)
    event_id = draft_data.get("event_id")
    if event_id:
        players = list(
            db.collection("players").where("event_id", "==", event_id).stream()
        )
        count += len(players)

    # Count from draft_players (standalone)
    draft_id = draft_data.get("id")
    if draft_id:
        draft_players = list(
            db.collection("draft_players").where("draft_id", "==", draft_id).stream()
        )
        count += len(draft_players)

    return count
