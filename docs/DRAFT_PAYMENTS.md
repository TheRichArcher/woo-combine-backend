# Draft Payments - Stripe Integration

## Overview
WooCombine supports paid drafts with OnlineDraft-style pricing.

## Pricing Tiers
| Tier | Teams | Price |
|------|-------|-------|
| Free | Any (≤15 players) | $0 |
| Basic | 2-5 | $19.99 |
| Standard | 6-10 | $29.99 |
| Plus | 11-15 | $34.99 |
| Pro | 16+ | $39.99 |

## Environment Variables

### To Enable Payments (Production)
```bash
DRAFT_PAYMENTS_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### For Testing (Default)
Payments are disabled by default. All drafts are free.

## API Endpoints

### GET /api/draft-payments/pricing/{draft_id}
Get pricing info for a draft.

### POST /api/draft-payments/create-checkout
Create Stripe checkout session.

### POST /api/draft-payments/webhook
Handle Stripe webhooks (payment confirmation).

### POST /api/draft-payments/bypass-payment/{draft_id}
DEV ONLY: Bypass payment for testing.

## Frontend Flow
1. User clicks "Start Draft" in DraftSetup
2. Redirects to `/draft/:id/payment`
3. Payment page shows pricing + start button
4. If free or paid: starts draft
5. If payment required: redirects to Stripe Checkout

## Stripe Setup (When Ready)
1. Create Stripe account at https://stripe.com
2. Create Product "Draft Access" with price variants
3. Set STRIPE_SECRET_KEY in Render
4. Create webhook endpoint pointing to /api/draft-payments/webhook
5. Set STRIPE_WEBHOOK_SECRET
6. Set DRAFT_PAYMENTS_ENABLED=true
7. Deploy

## Testing Payment Flow
With payments disabled, the payment page shows "Free" and allows starting immediately.

## Standalone Drafts (No Combine Required)

You can now use the draft feature without running a combine first.

### Creating a Standalone Draft
- `event_id` is now optional when creating a draft
- Add players directly via `POST /api/drafts/{draft_id}/players`
- Or bulk add via `POST /api/drafts/{draft_id}/players/bulk`

### API Endpoints for Standalone Players

**Add single player:**
```bash
POST /api/drafts/{draft_id}/players
{
  "name": "John Smith",
  "number": "23",
  "position": "Guard",
  "age_group": "U12"
}
```

**Bulk add players:**
```bash
POST /api/drafts/{draft_id}/players/bulk
{
  "players": [
    {"name": "Player 1", "number": "1"},
    {"name": "Player 2", "number": "2"}
  ]
}
```

**Remove player:**
```bash
DELETE /api/drafts/{draft_id}/players/{player_id}
```

### Mixed Mode
You can also use both:
- Link to an event (combine data)
- AND add additional players manually

The player pool will combine both sources.
