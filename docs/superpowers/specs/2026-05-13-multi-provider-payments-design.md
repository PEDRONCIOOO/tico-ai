# Multi-Provider Payments: AbacatePay + Stripe

**Date:** 2026-05-13
**Status:** Approved
**Approach:** Provider Abstraction Layer (Abordagem 1)

## Objective

Add Stripe as a second payment provider alongside AbacatePay. AbacatePay handles PIX (BRL), Stripe handles credit card subscriptions (USD). Both options are always visible to the user — no geo-gating.

## Pricing

| Plan      | PIX (AbacatePay) | Card (Stripe) |
|-----------|-------------------|---------------|
| Free      | R$0               | $0            |
| Pro       | R$45/mês          | $9.99/mo      |
| Unlimited | R$99,90/mês       | $19.99/mo     |

## 1. Database Schema Changes

### Table: `profiles` — new columns

```sql
ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN payment_provider TEXT; -- 'abacatepay' | 'stripe'
```

- `stripe_customer_id`: maps user to Stripe Customer object. Created on first Stripe checkout.
- `payment_provider`: which provider manages the active subscription. NULL for free users.
- `subscription_id` (existing): stores AbacatePay billing ID or Stripe Subscription ID — already TEXT, no change needed.

### Table: `payments` — new columns

```sql
ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL DEFAULT 'abacatepay'; -- 'abacatepay' | 'stripe'
ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'BRL'; -- 'BRL' | 'USD'
```

### Table: `webhook_events` — no changes

The `id` field is already free-form TEXT. AbacatePay uses `event:data.id`, Stripe will use `event:evt_xxx`.

### Tables: `usage`, RPCs — no changes

Usage metering is provider-agnostic.

## 2. Checkout Flow

### Unified route: `POST /api/checkout/create-subscription`

**Request body:**

```json
{ "plan": "pro" | "unlimited", "paymentMethod": "pix" | "card" }
```

**Logic:**

1. Validate auth (Supabase JWT) — unchanged.
2. Set `pending_plan` on profile — unchanged.
3. Route by `paymentMethod`:

**`"pix"` → AbacatePay (existing flow, unchanged):**
- Call `abacate.billing.create()` with product inline
- Store `subscription_id` on profile
- Return `{ url }` (AbacatePay checkout URL)

**`"card"` → Stripe:**
- Create or reuse Stripe Customer:
  - If `profiles.stripe_customer_id` exists, use it
  - Otherwise, `stripe.customers.create({ email })`, save to profile
- Create Checkout Session:
  ```js
  stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?upgraded=true`,
    cancel_url: `${baseUrl}/upgrade`,
  })
  ```
- Set `payment_provider: 'stripe'` on profile
- Return `{ url }` (Stripe Checkout URL)

**Price resolution:**

| Plan      | Env Var                | Value       |
|-----------|------------------------|-------------|
| Pro       | `STRIPE_PRICE_PRO`     | `price_...` |
| Unlimited | `STRIPE_PRICE_UNLIMITED` | `price_...` |

Price objects are created once in Stripe Dashboard (recurring monthly, USD).

## 3. Webhooks

Two separate endpoints. Both call a shared `activateSubscription()` function.

### 3.1 AbacatePay Webhook: `POST /api/webhook/abacatepay`

**No changes.** Existing handler continues as-is. Only addition: pass `provider: 'abacatepay'` and `currency: 'BRL'` when inserting into `payments`.

### 3.2 Stripe Webhook: `POST /api/webhook/stripe`

**Signature verification:** `stripe.webhooks.constructEvent(body, sig, secret)` using `stripe-signature` header and `STRIPE_WEBHOOK_SECRET`.

**Events handled:**

| Stripe Event                       | Action                                                        |
|------------------------------------|---------------------------------------------------------------|
| `checkout.session.completed`       | Resolve user by `client_reference_id`, activate tier from `pending_plan` |
| `invoice.paid`                     | Renewal — update `current_period_end`, insert into `payments` |
| `customer.subscription.deleted`    | Revert to `free`, set `subscription_status: 'cancelled'`     |
| `customer.subscription.updated`    | Detect cancellation at period end, update status accordingly  |

**User resolution (priority order):**
1. `client_reference_id` from Checkout Session (most reliable — we set it)
2. Lookup `profiles.stripe_customer_id` matching `event.data.object.customer`

### 3.3 Shared function: `activateSubscription()`

Extracted from current AbacatePay webhook logic. Both webhooks call this.

```ts
interface ActivateSubscriptionParams {
  userId: string
  provider: 'abacatepay' | 'stripe'
  subscriptionId: string
  plan: 'pro' | 'unlimited'
  amount: number
  currency: 'BRL' | 'USD'
  paidAt: Date
  periodEnd: Date
}

async function activateSubscription(params: ActivateSubscriptionParams) {
  // 1. Update profile: tier, subscription_id, payment_provider,
  //    subscription_status, current_period_end, pending_plan = null
  // 2. Insert into payments: billing_id, amount, plan, provider, currency, paid_at
  // 3. Insert into webhook_events for idempotency
}
```

Similarly, extract `deactivateSubscription()` for cancellation/refund events.

## 4. Stripe Customer Portal

### New route: `POST /api/checkout/customer-portal`

```ts
// Only works for users with stripe_customer_id
const session = await stripe.billingPortal.sessions.create({
  customer: profile.stripe_customer_id,
  return_url: `${baseUrl}/dashboard`,
})
return { url: session.url }
```

**Dashboard integration:** If `payment_provider === 'stripe'`, show "Manage subscription" button that calls this route and redirects.

**Portal capabilities (configured in Stripe Dashboard):**
- View invoices
- Update payment method
- Cancel subscription

## 5. Frontend — Upgrade Page

### `UpgradePlans.tsx` changes

Each plan card shows both prices and two checkout buttons:

```
Pro
R$45/mês · $9.99/mo
[Pagar com PIX]  [Pay with Card]

Unlimited
R$99,90/mês · $19.99/mo
[Pagar com PIX]  [Pay with Card]
```

`startCheckout(plan, paymentMethod)` sends `{ plan, paymentMethod }` to the existing route.

### Dashboard changes

- If `payment_provider === 'stripe'`: show "Manage subscription" button → calls `/api/checkout/customer-portal`
- If `payment_provider === 'abacatepay'`: current behavior (no self-service portal)
- Payment history: show `currency` alongside amount (e.g., "R$45,00" or "$9.99")

## 6. i18n (Scoped)

**In scope for this spec:**
- Upgrade page (`/upgrade`): plan titles, descriptions, buttons
- Dashboard: tier labels, usage text, payment history labels
- Detection via `Accept-Language` header, manual toggle stored in cookie
- Simple dictionary object (`pt-br` / `en`), ~30-40 strings total

**Out of scope:**
- Landing page, docs, onboarding, emails (separate i18n spec)
- WPF desktop app (remains PT-BR only)
- Proxy error messages

**Implementation:** A `lib/i18n.ts` file exporting `t(key, locale)` with a flat dictionary. Server components read locale from cookie/header. Client components receive locale as prop.

## 7. Environment Variables

### New

| Variable                | Description                          |
|-------------------------|--------------------------------------|
| `STRIPE_SECRET_KEY`     | Stripe API secret key (`sk_...`)     |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature secret (`whsec_...`) |
| `STRIPE_PRICE_PRO`     | Price ID for Pro plan (`price_...`)  |
| `STRIPE_PRICE_UNLIMITED` | Price ID for Unlimited plan (`price_...`) |

### Unchanged

`ABACATEPAY_API_TOKEN`, `ABACATEPAY_WEBHOOK_SECRET`, all Supabase/API keys.

### New dependency

```json
"stripe": "^17.0.0"
```

## 8. Stripe Dashboard Setup (Manual, Once)

1. Create two Products with recurring monthly Prices ($9.99 and $19.99 USD)
2. Configure webhook endpoint → `https://<domain>/api/webhook/stripe`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
3. Enable Customer Portal in Stripe settings (invoices, payment method update, cancellation)
4. Copy Price IDs and secrets to env vars

## 9. Files Changed/Created

| File | Change |
|------|--------|
| `web/supabase/migrations/0004_stripe_provider.sql` | New migration: add columns |
| `web/supabase/schema.sql` | Update with new columns |
| `web/src/app/api/checkout/create-subscription/route.ts` | Add Stripe branch |
| `web/src/app/api/checkout/customer-portal/route.ts` | New: Stripe portal session |
| `web/src/app/api/webhook/stripe/route.ts` | New: Stripe webhook handler |
| `web/src/app/api/webhook/abacatepay/route.ts` | Extract shared logic, add provider/currency |
| `web/src/lib/payments.ts` | New: `activateSubscription()`, `deactivateSubscription()` |
| `web/src/lib/i18n.ts` | New: translation dictionary + `t()` helper |
| `web/src/app/upgrade/UpgradePlans.tsx` | Dual buttons, dual prices, i18n |
| `web/src/app/dashboard/page.tsx` | Portal button, currency display, i18n |
| `web/package.json` | Add `stripe` dependency |

## 10. What Does NOT Change

- AbacatePay webhook handler logic (only extraction of shared parts)
- Proxy (`worker.js`, `local-server.js`) — usage enforcement is provider-agnostic
- WPF desktop app — tier display and usage limits are unchanged
- Supabase RPCs (`check_usage`, `increment_usage`) — unaffected
- Auth model — unchanged
