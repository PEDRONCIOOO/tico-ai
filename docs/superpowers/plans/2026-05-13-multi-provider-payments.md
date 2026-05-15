# Multi-Provider Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe as a second payment provider alongside AbacatePay, with dual checkout buttons (PIX + Card), separate webhooks, and scoped i18n for upgrade/dashboard pages.

**Architecture:** Provider abstraction layer — a shared `activateSubscription()` function called by both webhook handlers. Stripe Checkout (hosted) for card payments. AbacatePay unchanged for PIX. Simple i18n dictionary for PT-BR/EN on upgrade and dashboard pages.

**Tech Stack:** Next.js 16, Stripe SDK (Node.js), Supabase (Postgres + RLS), Tailwind 4

**Spec:** `docs/superpowers/specs/2026-05-13-multi-provider-payments-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web/supabase/migrations/0005_stripe_provider.sql` | Create | DB migration: add stripe_customer_id, payment_provider to profiles; provider, currency to payments |
| `web/supabase/schema.sql` | Modify | Update schema to reflect new columns |
| `web/src/lib/payments.ts` | Create | Shared `activateSubscription()` and `deactivateSubscription()` functions |
| `web/src/lib/stripe.ts` | Create | Stripe SDK singleton instance |
| `web/src/lib/i18n.ts` | Create | Translation dictionary + `t()` helper + locale detection |
| `web/src/app/api/checkout/create-subscription/route.ts` | Modify | Add Stripe checkout branch based on `paymentMethod` |
| `web/src/app/api/checkout/customer-portal/route.ts` | Create | Stripe Customer Portal session creation |
| `web/src/app/api/webhook/stripe/route.ts` | Create | Stripe webhook handler |
| `web/src/app/api/webhook/abacatepay/route.ts` | Modify | Extract shared logic to `lib/payments.ts`, add provider/currency |
| `web/src/app/upgrade/page.tsx` | Modify | i18n for server-rendered text |
| `web/src/app/upgrade/UpgradePlans.tsx` | Modify | Dual buttons (PIX + Card), dual prices, i18n |
| `web/src/app/dashboard/page.tsx` | Modify | Portal button, currency display, i18n |
| `web/package.json` | Modify | Add `stripe` dependency |

---

### Task 1: Install Stripe SDK

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install stripe**

```bash
cd web && npm install stripe
```

- [ ] **Step 2: Verify installation**

Run: `cd web && node -e "require('stripe'); console.log('ok')"`
Expected: `ok`

---

### Task 2: Database Migration

**Files:**
- Create: `web/supabase/migrations/0005_stripe_provider.sql`
- Modify: `web/supabase/schema.sql`

- [ ] **Step 1: Create migration file**

Create `web/supabase/migrations/0005_stripe_provider.sql`:

```sql
-- Add Stripe support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_provider TEXT;

-- Add provider and currency to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'abacatepay';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';
```

- [ ] **Step 2: Update schema.sql to reflect new columns**

In `web/supabase/schema.sql`, update the `profiles` table definition (lines 4-15) to:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  tier text not null default 'free' check (tier in ('free', 'pro', 'unlimited')),
  subscription_id text,
  subscription_status text default 'active',
  abacatepay_customer_id text,
  stripe_customer_id text,
  payment_provider text, -- 'abacatepay' | 'stripe'
  pending_plan text check (pending_plan in ('pro', 'unlimited')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

And update the `payments` table (currently defined in migration 0003, add to schema.sql if not already present) to include:

```sql
-- In the payments table definition, add:
  provider text not null default 'abacatepay',
  currency text not null default 'BRL',
```

- [ ] **Step 3: Run migration against Supabase**

Run: `cd web && npx supabase db push`
Expected: Migration applied successfully. Verify with: `npx supabase db diff` should show no pending changes.

If using Supabase Dashboard directly, paste the SQL from Step 1 into the SQL Editor and run.

---

### Task 3: Stripe SDK Singleton

**Files:**
- Create: `web/src/lib/stripe.ts`

- [ ] **Step 1: Create Stripe instance module**

Create `web/src/lib/stripe.ts`:

```ts
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  throw new Error('STRIPE_SECRET_KEY not set')
}

export const stripe = new Stripe(key)
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit src/lib/stripe.ts 2>&1 || echo "check errors"`

If TypeScript complains about isolated modules, just verify with: `cd web && npm run build` after all tasks are done. This file is simple enough to trust.

---

### Task 4: Shared Payment Functions

**Files:**
- Create: `web/src/lib/payments.ts`

- [ ] **Step 1: Create shared payment module**

Create `web/src/lib/payments.ts`:

```ts
import { createServiceClient } from '@/lib/supabase-server'

export type PaymentProvider = 'abacatepay' | 'stripe'
export type Currency = 'BRL' | 'USD'
export type PlanId = 'pro' | 'unlimited'

export interface ActivateSubscriptionParams {
  userId: string
  provider: PaymentProvider
  subscriptionId: string
  plan: PlanId
  amount: number
  currency: Currency
  paidAt: Date
  periodEnd: Date
}

export async function activateSubscription(
  service: ReturnType<typeof createServiceClient>,
  params: ActivateSubscriptionParams,
) {
  const { userId, provider, subscriptionId, plan, amount, currency, paidAt, periodEnd } = params

  await service
    .from('profiles')
    .update({
      tier: plan,
      subscription_id: subscriptionId,
      payment_provider: provider,
      subscription_status: 'active',
      pending_plan: null,
      current_period_end: periodEnd.toISOString(),
      updated_at: paidAt.toISOString(),
    })
    .eq('id', userId)

  await service
    .from('payments')
    .upsert(
      {
        user_id: userId,
        billing_id: subscriptionId,
        amount,
        plan,
        provider,
        currency,
        paid_at: paidAt.toISOString(),
      },
      { onConflict: 'billing_id' },
    )
}

export async function deactivateSubscription(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  status: 'cancelled' | 'refunded' | 'failed',
) {
  await service
    .from('profiles')
    .update({
      tier: 'free',
      subscription_status: status,
      pending_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}
```

---

### Task 5: i18n Dictionary

**Files:**
- Create: `web/src/lib/i18n.ts`

- [ ] **Step 1: Create i18n module**

Create `web/src/lib/i18n.ts`:

```ts
export type Locale = 'pt-br' | 'en'

const dict: Record<string, Record<Locale, string>> = {
  // Upgrade page
  'upgrade.title': { 'pt-br': 'escolha seu plano', en: 'choose your plan' },
  'upgrade.subtitle': { 'pt-br': 'paga com pix ou cartão. cancela quando quiser.', en: 'pay with pix or card. cancel anytime.' },
  'upgrade.footer': { 'pt-br': 'assinatura mensal renovada automaticamente.', en: 'monthly subscription renewed automatically.' },
  'upgrade.back': { 'pt-br': 'voltar', en: 'back' },

  // Plan names
  'plan.free': { 'pt-br': 'grátis', en: 'free' },
  'plan.pro': { 'pt-br': 'pro', en: 'pro' },
  'plan.unlimited': { 'pt-br': 'ilimitado', en: 'unlimited' },

  // Plan periods
  'plan.forever': { 'pt-br': 'pra sempre', en: 'forever' },
  'plan.perMonth': { 'pt-br': '/mês', en: '/mo' },

  // Plan features
  'feat.10day': { 'pt-br': '10 usos por dia', en: '10 uses per day' },
  'feat.500month': { 'pt-br': '500 usos por mês', en: '500 uses per month' },
  'feat.unlimited': { 'pt-br': 'usos ilimitados', en: 'unlimited uses' },
  'feat.voice': { 'pt-br': 'voz natural em português', en: 'natural voice' },
  'feat.cursor': { 'pt-br': 'tico cursor inteligente', en: 'tico smart cursor' },
  'feat.cursorPointing': { 'pt-br': 'tico cursor + pointing', en: 'tico cursor + pointing' },
  'feat.sonnet': { 'pt-br': 'modelo claude sonnet', en: 'claude sonnet model' },
  'feat.opus': { 'pt-br': 'modelo claude opus', en: 'claude opus model' },
  'feat.priority': { 'pt-br': 'suporte prioritário', en: 'priority support' },
  'feat.earlyAccess': { 'pt-br': 'acesso antecipado a novidades', en: 'early access to new features' },

  // Buttons
  'btn.pix': { 'pt-br': 'pagar com pix', en: 'pay with pix' },
  'btn.card': { 'pt-br': 'pagar com cartão', en: 'pay with card' },
  'btn.currentPlan': { 'pt-br': 'plano atual', en: 'current plan' },
  'btn.defaultPlan': { 'pt-br': 'plano atual padrão', en: 'default plan' },
  'btn.redirecting': { 'pt-br': 'redirecionando...', en: 'redirecting...' },
  'btn.popular': { 'pt-br': 'popular', en: 'popular' },
  'btn.yourPlan': { 'pt-br': 'seu plano', en: 'your plan' },

  // Dashboard
  'dash.greeting': { 'pt-br': 'oi,', en: 'hi,' },
  'dash.subtitle': { 'pt-br': 'aqui voce gerencia sua conta do tico.', en: 'manage your tico account here.' },
  'dash.yourPlan': { 'pt-br': 'seu plano', en: 'your plan' },
  'dash.unlimitedUses': { 'pt-br': 'usos ilimitados', en: 'unlimited uses' },
  'dash.uses': { 'pt-br': 'usos', en: 'uses' },
  'dash.remaining': { 'pt-br': 'restantes', en: 'remaining' },
  'dash.resetsDaily': { 'pt-br': 'reseta em 24h', en: 'resets in 24h' },
  'dash.resetsMonthly': { 'pt-br': 'reseta todo mes', en: 'resets monthly' },
  'dash.upgrade': { 'pt-br': 'fazer upgrade', en: 'upgrade' },
  'dash.yourAccount': { 'pt-br': 'sua conta', en: 'your account' },
  'dash.email': { 'pt-br': 'email', en: 'email' },
  'dash.name': { 'pt-br': 'nome', en: 'name' },
  'dash.download': { 'pt-br': 'baixe o tico', en: 'download tico' },
  'dash.downloadDesc': { 'pt-br': 'instale no windows e faca login com essa mesma conta.', en: 'install on windows and log in with this account.' },
  'dash.downloadBtn': { 'pt-br': 'baixar para windows', en: 'download for windows' },
  'dash.nextPayment': { 'pt-br': 'próximo pagamento', en: 'next payment' },
  'dash.autoRenewal': { 'pt-br': 'renovação automática', en: 'auto renewal' },
  'dash.payments': { 'pt-br': 'pagamentos', en: 'payments' },
  'dash.noPayments': { 'pt-br': 'nenhum pagamento registrado', en: 'no payments recorded' },
  'dash.manageSubscription': { 'pt-br': 'gerenciar assinatura', en: 'manage subscription' },
  'dash.logout': { 'pt-br': 'sair', en: 'log out' },
  'dash.appToken': { 'pt-br': 'token do app', en: 'app token' },
  'dash.appTokenDesc': { 'pt-br': 'use esse token pra fazer login no app do tico no windows.', en: 'use this token to log in to the tico windows app.' },
  'dash.copy': { 'pt-br': 'copiar', en: 'copy' },
  'dash.copied': { 'pt-br': 'copiado!', en: 'copied!' },
  'dash.loading': { 'pt-br': 'carregando...', en: 'loading...' },
  'dash.feedback': { 'pt-br': 'feedback', en: 'feedback' },
  'dash.feedbackDesc': { 'pt-br': 'encontrou um bug ou tem uma ideia? manda pra gente.', en: 'found a bug or have an idea? let us know.' },
  'dash.feedbackPlaceholder': { 'pt-br': 'escreva aqui...', en: 'write here...' },
  'dash.feedbackSend': { 'pt-br': 'enviar', en: 'send' },
  'dash.feedbackSending': { 'pt-br': 'enviando...', en: 'sending...' },
  'dash.feedbackSent': { 'pt-br': 'mensagem enviada! obrigado pelo feedback.', en: 'message sent! thanks for the feedback.' },
  'dash.feedbackError': { 'pt-br': 'erro ao enviar, tente de novo', en: 'error sending, try again' },

  // Upgrade banner
  'banner.confirmed': { 'pt-br': 'pagamento confirmado!', en: 'payment confirmed!' },
  'banner.updating': { 'pt-br': 'seu plano será atualizado em alguns segundos.', en: 'your plan will be updated in a few seconds.' },

  // Tier names
  'tier.free': { 'pt-br': 'Gratis', en: 'Free' },
  'tier.pro': { 'pt-br': 'Pro', en: 'Pro' },
  'tier.unlimited': { 'pt-br': 'Ilimitado', en: 'Unlimited' },
}

export function t(key: string, locale: Locale): string {
  return dict[key]?.[locale] ?? dict[key]?.['en'] ?? key
}

export function detectLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return 'en'
  const lower = acceptLanguage.toLowerCase()
  if (lower.startsWith('pt')) return 'pt-br'
  return 'en'
}

export function getLocaleFromCookie(cookieValue?: string | null): Locale | null {
  if (cookieValue === 'pt-br' || cookieValue === 'en') return cookieValue
  return null
}
```

---

### Task 6: Refactor AbacatePay Webhook to Use Shared Functions

**Files:**
- Modify: `web/src/app/api/webhook/abacatepay/route.ts`

- [ ] **Step 1: Update imports and billing.paid handler**

At the top of `web/src/app/api/webhook/abacatepay/route.ts`, add import (after line 3):

```ts
import { activateSubscription, deactivateSubscription } from '@/lib/payments'
```

- [ ] **Step 2: Replace the billing.paid case (lines 108-157)**

Replace the `case 'billing.paid':` block with:

```ts
    case 'billing.paid': {
      const { data: profile } = await service
        .from('profiles')
        .select('tier, pending_plan')
        .eq('id', userId)
        .single()

      const targetTier = profile?.pending_plan
        ?? (profile?.tier !== 'free' ? profile?.tier : null)

      if (!targetTier) {
        console.warn(`billing.paid for ${userId.slice(0, 8)}: no pending_plan and current tier is free — can't resolve plan`)
        return
      }

      const amount = data.amount ?? 0
      const billingId = data.id ?? ''
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      console.log(`billing.paid: setting ${userId.slice(0, 8)} to ${targetTier} (R$${(amount / 100).toFixed(2)})`)

      await activateSubscription(service, {
        userId,
        provider: 'abacatepay',
        subscriptionId: billingId,
        plan: targetTier as 'pro' | 'unlimited',
        amount,
        currency: 'BRL',
        paidAt: now,
        periodEnd,
      })
      break
    }
```

- [ ] **Step 3: Replace refund/cancel cases (lines 161-189)**

Replace the `billing.refunded`, `billing.failed`, `subscription.canceled`, `subscription.cancelled` cases:

```ts
    case 'billing.refunded':
    case 'billing.failed': {
      console.log(`${eventType}: reverting ${userId.slice(0, 8)} to free`)
      await deactivateSubscription(
        service,
        userId,
        eventType === 'billing.refunded' ? 'refunded' : 'failed',
      )
      break
    }

    case 'subscription.canceled':
    case 'subscription.cancelled': {
      console.log(`${eventType}: reverting ${userId.slice(0, 8)} to free`)
      await deactivateSubscription(service, userId, 'cancelled')
      break
    }
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors.

---

### Task 7: Stripe Webhook Handler

**Files:**
- Create: `web/src/app/api/webhook/stripe/route.ts`

- [ ] **Step 1: Create Stripe webhook route**

Create `web/src/app/api/webhook/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase-server'
import { activateSubscription, deactivateSubscription } from '@/lib/payments'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'missing stripe-signature' }, { status: 401 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err: any) {
    console.warn('Stripe signature verification failed:', err.message)
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const service = createServiceClient()

  // Idempotency
  const idempotencyKey = `stripe:${event.id}`
  const { error: insertErr } = await service
    .from('webhook_events')
    .insert({ id: idempotencyKey, event: event.type, payload: event })

  if (insertErr) {
    if (insertErr.code === '23505') {
      console.log(`Duplicate Stripe webhook ${event.id} — ignoring`)
      return NextResponse.json({ status: 'duplicate' })
    }
    console.error('Failed to insert webhook event:', insertErr)
    return NextResponse.json({ error: 'storage failed' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        if (!userId) {
          console.warn('checkout.session.completed: no client_reference_id')
          break
        }

        const { data: profile } = await service
          .from('profiles')
          .select('pending_plan')
          .eq('id', userId)
          .single()

        const plan = profile?.pending_plan
        if (!plan) {
          console.warn(`checkout.session.completed for ${userId.slice(0, 8)}: no pending_plan`)
          break
        }

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? ''

        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 1)

        console.log(`checkout.session.completed: setting ${userId.slice(0, 8)} to ${plan}`)

        await activateSubscription(service, {
          userId,
          provider: 'stripe',
          subscriptionId,
          plan: plan as 'pro' | 'unlimited',
          amount: session.amount_total ?? 0,
          currency: 'USD',
          paidAt: now,
          periodEnd,
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

        if (!customerId) break

        const { data: profile } = await service
          .from('profiles')
          .select('id, tier')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) {
          console.warn(`invoice.paid: no profile for customer ${customerId}`)
          break
        }

        // Skip first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') break

        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? ''

        const periodEnd = invoice.lines?.data?.[0]?.period?.end
          ? new Date(invoice.lines.data[0].period.end * 1000)
          : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d })()

        console.log(`invoice.paid: renewing ${profile.id.slice(0, 8)} (${profile.tier})`)

        await activateSubscription(service, {
          userId: profile.id,
          provider: 'stripe',
          subscriptionId,
          plan: profile.tier as 'pro' | 'unlimited',
          amount: invoice.amount_paid ?? 0,
          currency: 'USD',
          paidAt: new Date(),
          periodEnd,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string'
          ? sub.customer
          : sub.customer?.id

        if (!customerId) break

        const { data: profile } = await service
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) break

        console.log(`customer.subscription.deleted: reverting ${profile.id.slice(0, 8)} to free`)
        await deactivateSubscription(service, profile.id, 'cancelled')
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        if (sub.cancel_at_period_end) {
          const customerId = typeof sub.customer === 'string'
            ? sub.customer
            : sub.customer?.id
          if (!customerId) break

          const { data: profile } = await service
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (profile) {
            console.log(`customer.subscription.updated: ${profile.id.slice(0, 8)} will cancel at period end`)
            await service
              .from('profiles')
              .update({
                subscription_status: 'cancelling',
                updated_at: new Date().toISOString(),
              })
              .eq('id', profile.id)
          }
        }
        break
      }

      default:
        console.log(`Ignoring Stripe event: ${event.type}`)
    }
  } catch (err: any) {
    console.error(`Error handling Stripe ${event.type}:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

---

### Task 8: Update Checkout Route for Dual Provider Support

**Files:**
- Modify: `web/src/app/api/checkout/create-subscription/route.ts`

- [ ] **Step 1: Rewrite the checkout route**

Replace the entire content of `web/src/app/api/checkout/create-subscription/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import AbacatePay from 'abacatepay-nodejs-sdk'
import { stripe } from '@/lib/stripe'

type PlanId = 'pro' | 'unlimited'
type PaymentMethod = 'pix' | 'card'

const ABACATEPAY_PLANS: Record<PlanId, { externalId: string; name: string; description: string; priceCents: number }> = {
  pro: {
    externalId: 'tico-pro',
    name: 'Tico Pro',
    description: '500 usos por mês',
    priceCents: 4500,
  },
  unlimited: {
    externalId: 'tico-unlimited',
    name: 'Tico Ilimitado',
    description: 'Usos ilimitados',
    priceCents: 9990,
  },
}

const STRIPE_PRICES: Record<PlanId, string> = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  unlimited: process.env.STRIPE_PRICE_UNLIMITED ?? '',
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const plan = body.plan as PlanId | undefined
  const paymentMethod = (body.paymentMethod as PaymentMethod | undefined) ?? 'pix'

  if (!plan || !ABACATEPAY_PLANS[plan]) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('email, display_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'profile not found' }, { status: 500 })
  }

  // Persist pending plan for the webhook
  await service.from('profiles').update({ pending_plan: plan }).eq('id', user.id)

  const webBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? new URL(req.url).origin

  if (paymentMethod === 'card') {
    return handleStripeCheckout(service, user.id, profile, plan, webBaseUrl)
  }

  return handleAbacatePayCheckout(service, user.id, profile, plan, webBaseUrl)
}

async function handleStripeCheckout(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  profile: { email: string; display_name: string | null; stripe_customer_id: string | null },
  plan: PlanId,
  baseUrl: string,
) {
  const priceId = STRIPE_PRICES[plan]
  if (!priceId) {
    return NextResponse.json({ error: `STRIPE_PRICE_${plan.toUpperCase()} not set` }, { status: 500 })
  }

  try {
    // Create or reuse Stripe customer
    let customerId = profile.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.display_name || undefined,
        metadata: { supabase_user_id: userId },
      })
      customerId = customer.id
      await service
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: `${baseUrl}/upgrade`,
    })

    // Store payment provider (subscription_id is set later by the webhook
    // when checkout.session.completed fires — session.subscription is null here)
    await service
      .from('profiles')
      .update({ payment_provider: 'stripe' })
      .eq('id', userId)

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err.message)
    return NextResponse.json({ error: err.message || 'Stripe checkout failed' }, { status: 502 })
  }
}

async function handleAbacatePayCheckout(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  profile: { email: string; display_name: string | null; stripe_customer_id: string | null },
  plan: PlanId,
  baseUrl: string,
) {
  const token = process.env.ABACATEPAY_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'ABACATEPAY_API_TOKEN not set' }, { status: 500 })
  }

  const planDef = ABACATEPAY_PLANS[plan]

  try {
    const abacate = AbacatePay(token)

    const billing = await abacate.billing.create({
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: [{
        externalId: planDef.externalId,
        name: planDef.name,
        quantity: 1,
        price: planDef.priceCents,
        description: planDef.description,
      }],
      returnUrl: `${baseUrl}/upgrade`,
      completionUrl: `${baseUrl}/dashboard?upgraded=true`,
      customer: {
        name: profile.display_name || profile.email.split('@')[0],
        email: profile.email,
        cellphone: '+5511999999999',
        taxId: '09240529020',
      },
    })

    const billingData = (billing as any)?.data ?? billing
    const checkoutUrl = billingData?.url
    const billingId = billingData?.id

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'AbacatePay retornou sem URL' }, { status: 502 })
    }

    if (billingId) {
      await service
        .from('profiles')
        .update({ subscription_id: billingId, payment_provider: 'abacatepay' })
        .eq('id', userId)
    }

    return NextResponse.json({ url: checkoutUrl })
  } catch (err: any) {
    console.error('AbacatePay SDK error:', err.message || err)
    return NextResponse.json(
      { error: err.message || 'AbacatePay SDK falhou' },
      { status: 502 },
    )
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

---

### Task 9: Stripe Customer Portal Route

**Files:**
- Create: `web/src/app/api/checkout/customer-portal/route.ts`

- [ ] **Step 1: Create customer portal route**

Create `web/src/app/api/checkout/customer-portal/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'no stripe customer' }, { status: 400 })
  }

  const webBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? new URL(req.url).origin

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${webBaseUrl}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

---

### Task 10: Update Upgrade Page (i18n + Server Component)

**Files:**
- Modify: `web/src/app/upgrade/page.tsx`

- [ ] **Step 1: Rewrite upgrade page with i18n**

Replace the entire content of `web/src/app/upgrade/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { UpgradePlans } from './UpgradePlans'
import { t, detectLocale, getLocaleFromCookie, type Locale } from '@/lib/i18n'

export default async function UpgradePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, display_name, tier')
    .eq('id', user.id)
    .single()

  const currentTier = profile?.tier || 'free'

  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale: Locale =
    getLocaleFromCookie(cookieStore.get('locale')?.value) ??
    detectLocale(headerStore.get('accept-language'))

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="border-b border-black/[0.04] bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
          </a>
          <a href="/dashboard" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">
            {t('upgrade.back', locale)}
          </a>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {t('upgrade.title', locale)}
          </h1>
          <p className="text-[#8A8A8A] text-base md:text-lg">
            {t('upgrade.subtitle', locale)}
          </p>
        </div>

        <UpgradePlans currentTier={currentTier} locale={locale} />

        <p className="text-center text-xs text-[#8A8A8A] mt-10">
          {t('upgrade.footer', locale)}
        </p>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify build after Task 11 (UpgradePlans depends on locale prop)**

This will only build correctly after Task 11 updates `UpgradePlans.tsx`.

---

### Task 11: Update UpgradePlans Component (Dual Buttons + i18n)

**Files:**
- Modify: `web/src/app/upgrade/UpgradePlans.tsx`

- [ ] **Step 1: Rewrite UpgradePlans with dual buttons and i18n**

Replace the entire content of `web/src/app/upgrade/UpgradePlans.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { t, type Locale } from '@/lib/i18n'

type PlanDef = {
  id: 'free' | 'pro' | 'unlimited'
  nameKey: string
  priceBRL: string
  priceUSD: string | null
  periodKey: string
  featureKeys: string[]
  highlight?: boolean
}

const PLANS: PlanDef[] = [
  {
    id: 'free',
    nameKey: 'plan.free',
    priceBRL: 'R$0',
    priceUSD: null,
    periodKey: 'plan.forever',
    featureKeys: ['feat.10day', 'feat.voice', 'feat.cursor', 'feat.sonnet'],
  },
  {
    id: 'pro',
    nameKey: 'plan.pro',
    priceBRL: 'R$45',
    priceUSD: '$9.99',
    periodKey: 'plan.perMonth',
    highlight: true,
    featureKeys: ['feat.500month', 'feat.voice', 'feat.cursorPointing', 'feat.sonnet', 'feat.priority'],
  },
  {
    id: 'unlimited',
    nameKey: 'plan.unlimited',
    priceBRL: 'R$99,90',
    priceUSD: '$19.99',
    periodKey: 'plan.perMonth',
    featureKeys: ['feat.unlimited', 'feat.voice', 'feat.cursorPointing', 'feat.opus', 'feat.priority', 'feat.earlyAccess'],
  },
]

export function UpgradePlans({ currentTier, locale }: { currentTier: string; locale: Locale }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = async (plan: 'pro' | 'unlimited', paymentMethod: 'pix' | 'card') => {
    setLoading(`${plan}-${paymentMethod}`)
    setError(null)
    try {
      const res = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, paymentMethod }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `falha (${res.status})`)
      }
      const { url } = await res.json()
      if (!url) throw new Error('checkout sem url')
      window.location.href = url
    } catch (err: any) {
      setError(err.message)
      setLoading(null)
    }
  }

  return (
    <>
      {error && (
        <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentTier
          const isPaid = plan.id !== 'free'
          const isLoadingPix = loading === `${plan.id}-pix`
          const isLoadingCard = loading === `${plan.id}-card`
          const anyLoading = loading !== null

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-7 transition-all duration-300 ${
                plan.highlight
                  ? 'bg-[#1A1A1A] text-white shadow-[0_8px_40px_rgba(124,58,237,0.25)]'
                  : 'bg-white border border-gray-200/80'
              }`}
            >
              {plan.highlight && !isCurrent && (
                <div className="absolute -top-3 left-6 bg-[#FF6B6B] text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-full">
                  {t('btn.popular', locale)}
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-6 bg-[#10B981] text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-full">
                  {t('btn.yourPlan', locale)}
                </div>
              )}

              <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${plan.highlight ? 'text-purple-300' : 'text-[#8A8A8A]'}`}>
                {t(plan.nameKey, locale)}
              </p>

              {/* Prices */}
              <div className="mb-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {plan.priceBRL}
                  </span>
                  <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-[#8A8A8A]'}`}>
                    {t(plan.periodKey, locale)}
                  </span>
                </div>
                {plan.priceUSD && (
                  <p className={`text-sm mt-0.5 ${plan.highlight ? 'text-gray-400' : 'text-[#8A8A8A]'}`}>
                    {plan.priceUSD}{t(plan.periodKey, locale)}
                  </p>
                )}
              </div>

              <div className={`w-full h-px my-5 ${plan.highlight ? 'bg-white/10' : 'bg-gray-100'}`} />

              <ul className="space-y-3 mb-7">
                {plan.featureKeys.map((key, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                    <span className={`mt-0.5 text-xs ${plan.highlight ? 'text-[#FBBF24]' : 'text-[#7C3AED]'}`}>●</span>
                    <span className={plan.highlight ? 'text-gray-300' : 'text-[#4A4A4A]'}>{t(key, locale)}</span>
                  </li>
                ))}
              </ul>

              {isPaid && !isCurrent && (
                <div className="space-y-2">
                  <button
                    onClick={() => startCheckout(plan.id as 'pro' | 'unlimited', 'pix')}
                    disabled={anyLoading}
                    className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                      plan.highlight
                        ? 'bg-[#7C3AED] text-white hover:bg-[#5B21B6] shadow-lg shadow-purple-500/20'
                        : 'bg-[#1A1A1A] text-white hover:bg-gray-800'
                    }`}
                  >
                    {isLoadingPix ? t('btn.redirecting', locale) : `PIX · ${plan.priceBRL}`}
                  </button>
                  <button
                    onClick={() => startCheckout(plan.id as 'pro' | 'unlimited', 'card')}
                    disabled={anyLoading}
                    className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                      plan.highlight
                        ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                        : 'bg-[#F3F2EF] text-[#1A1A1A] hover:bg-[#E8E7E3] border border-gray-200/80'
                    }`}
                  >
                    {isLoadingCard ? t('btn.redirecting', locale) : `Card · ${plan.priceUSD}`}
                  </button>
                </div>
              )}

              {isCurrent && (
                <div className={`block w-full text-center py-3 rounded-xl text-sm font-semibold ${
                  plan.highlight ? 'bg-white/10 text-white' : 'bg-[#F3F2EF] text-[#8A8A8A]'
                }`}>
                  {t('btn.currentPlan', locale)}
                </div>
              )}

              {!isPaid && !isCurrent && (
                <div className="block w-full text-center py-3 rounded-xl text-sm font-semibold bg-[#F3F2EF] text-[#8A8A8A]">
                  {t('btn.defaultPlan', locale)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

---

### Task 12: Update Dashboard (Portal Button + Currency + i18n)

**Files:**
- Modify: `web/src/app/dashboard/page.tsx`

- [ ] **Step 1: Update Profile type and imports**

At the top of `web/src/app/dashboard/page.tsx`, update the `Profile` type (lines 7-13) and add i18n import:

Add after line 5:
```ts
import { t, detectLocale, getLocaleFromCookie, type Locale } from '@/lib/i18n'
```

Update the `Profile` type:
```ts
type Profile = {
  email: string
  display_name: string | null
  tier: string
  current_period_end: string | null
  payment_provider: string | null
  stripe_customer_id: string | null
}
```

Update the `Payment` type:
```ts
type Payment = {
  id: string
  amount: number
  plan: string
  paid_at: string
  provider: string
  currency: string
}
```

- [ ] **Step 2: Add locale detection to DashboardContent**

Inside `DashboardContent`, add locale state after the existing useState calls (after line 42):

```ts
const [locale, setLocale] = useState<Locale>('pt-br')
```

At the start of `loadData` (after line 71), add locale detection:

```ts
// Detect locale from cookie or browser language
const cookieLocale = document.cookie.match(/locale=(pt-br|en)/)?.[1] as Locale | undefined
const detected = cookieLocale ?? (navigator.language.startsWith('pt') ? 'pt-br' : 'en') as Locale
setLocale(detected)
```

- [ ] **Step 3: Update profile select to include new fields**

Update the profile select (line 81) to:
```ts
.select('email, display_name, tier, current_period_end, payment_provider, stripe_customer_id')
```

Update the payments select (line 94) to:
```ts
.select('id, amount, plan, paid_at, provider, currency')
```

- [ ] **Step 4: Add portal redirect function**

After `handleLogout` (after line 108), add:

```ts
const openPortal = async () => {
  try {
    const res = await fetch('/api/checkout/customer-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return
    const { url } = await res.json()
    if (url) window.location.href = url
  } catch {}
}
```

- [ ] **Step 5: Update tier names and labels to use i18n**

Replace `tierNames` (line 118):
```ts
const tierNames: Record<string, string> = {
  free: t('tier.free', locale),
  pro: t('tier.pro', locale),
  unlimited: t('tier.unlimited', locale),
}
```

- [ ] **Step 6: Add Manage Subscription button to Plan Card**

After the upgrade link (after line 219, the `</a>` for "fazer upgrade"), add:

```tsx
{profile?.payment_provider === 'stripe' && profile?.stripe_customer_id && usage?.tier !== 'free' && (
  <button
    onClick={openPortal}
    className="inline-block mt-2 text-sm text-[#8A8A8A] hover:text-[#1A1A1A] hover:underline transition"
  >
    {t('dash.manageSubscription', locale)} &rarr;
  </button>
)}
```

- [ ] **Step 7: Update next payment price display**

Replace the hardcoded price string (line 269):
```tsx
<p className="text-xs text-[#8A8A8A] mt-2">
  {profile?.payment_provider === 'stripe'
    ? `${profile.tier === 'pro' ? '$9.99' : '$19.99'} · ${t('dash.autoRenewal', locale)}`
    : `${profile?.tier === 'pro' ? 'R$45,00' : 'R$99,90'} · ${t('dash.autoRenewal', locale)}`
  }
</p>
```

- [ ] **Step 8: Update payment history to show currency**

Replace the payment amount display (line 293-294):
```tsx
<span className="text-sm font-semibold text-[#1A1A1A]">
  {p.currency === 'USD'
    ? `$${(p.amount / 100).toFixed(2)}`
    : `R$${(p.amount / 100).toFixed(2).replace('.', ',')}`
  }
</span>
```

- [ ] **Step 9: Replace remaining hardcoded strings with i18n**

Replace key hardcoded strings throughout the component with `t()` calls. The most important ones:

- `"sair"` → `{t('dash.logout', locale)}`
- `"oi,"` → `{t('dash.greeting', locale)}`
- `"aqui voce gerencia..."` → `{t('dash.subtitle', locale)}`
- `"seu plano"` heading → `{t('dash.yourPlan', locale)}`
- `"usos ilimitados"` → `{t('dash.unlimitedUses', locale)}`
- `"usos"` → `{t('dash.uses', locale)}`
- `"restantes"` → `{t('dash.remaining', locale)}`
- `"reseta em 24h"` → `{t('dash.resetsDaily', locale)}`
- `"reseta todo mes"` → `{t('dash.resetsMonthly', locale)}`
- `"fazer upgrade"` → `{t('dash.upgrade', locale)}`
- `"sua conta"` → `{t('dash.yourAccount', locale)}`
- `"baixe o tico"` → `{t('dash.download', locale)}`
- `"pagamento confirmado!"` → `{t('banner.confirmed', locale)}`
- `"token do app"` → `{t('dash.appToken', locale)}`
- FeedbackCard strings: pass `locale` as prop

- [ ] **Step 10: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds.

---

### Task 13: Final Build Verification and Manual Test

- [ ] **Step 1: Full build**

Run: `cd web && npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 2: Dev server smoke test**

Run: `cd web && npm run dev`

Verify in browser:
1. `/upgrade` — shows 3 plan cards, each paid plan has two buttons (PIX + Card), both BRL and USD prices visible
2. `/dashboard` — loads without errors, tier badge shows correctly
3. Language detection — open in incognito with English browser language, verify English strings appear

- [ ] **Step 3: Verify env vars are documented**

Ensure the following env vars are listed in any `.env.example` or docs:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_UNLIMITED`

---

## Summary of Changes

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1 | Install Stripe SDK | package.json | — |
| 2 | Database migration | migrations/0005, schema.sql | — |
| 3 | Stripe SDK singleton | lib/stripe.ts | 1 |
| 4 | Shared payment functions | lib/payments.ts | — |
| 5 | i18n dictionary | lib/i18n.ts | — |
| 6 | Refactor AbacatePay webhook | webhook/abacatepay/route.ts | 4 |
| 7 | Stripe webhook handler | webhook/stripe/route.ts | 3, 4 |
| 8 | Update checkout route | checkout/create-subscription/route.ts | 3 |
| 9 | Customer portal route | checkout/customer-portal/route.ts | 3 |
| 10 | Update upgrade page | upgrade/page.tsx | 5 |
| 11 | Update UpgradePlans | upgrade/UpgradePlans.tsx | 5 |
| 12 | Update dashboard | dashboard/page.tsx | 5, 9 |
| 13 | Final verification | — | all |
