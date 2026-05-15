import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase-server'
import { activateSubscription, deactivateSubscription } from '@/lib/payments'

/**
 * AbacatePay webhook handler — supports Webhook v1 payload format.
 *
 * v1 payload shape: { event, devMode, data: { id, externalId, customer, ... } }
 * (No top-level id — we derive an idempotency key from data.id + event.)
 *
 * Signature verification tries in order:
 *   1. HMAC-SHA256 of raw body via X-Webhook-Signature header (same as v2)
 *   2. query string ?webhookSecret=... matching ABACATEPAY_WEBHOOK_SECRET
 * Either being valid is enough. If neither works, we reject with 401.
 *
 * Events handled:
 *   billing.paid         → activate tier based on profiles.pending_plan
 *   billing.refunded     → revert to free
 *   subscription.canceled → revert to free
 *
 * Idempotency: webhook_events.id stores `<event>:<data.id>`. Duplicate
 * deliveries hit the unique constraint and return early.
 */

export async function POST(req: NextRequest) {
  const secret = process.env.ABACATEPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('ABACATEPAY_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await req.text()

  // Verify signature (HMAC header OR query string secret)
  if (!verifySignature(req, rawBody, secret)) {
    console.warn('Invalid webhook signature')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventType: string = payload.event
  const data = payload.data || {}
  // v1 nests everything under data.billing, v2 uses data directly
  const billing = data.billing ?? data.checkout ?? data
  const dataId: string | undefined = billing.id ?? data.id

  if (!eventType) {
    return NextResponse.json({ error: 'missing event' }, { status: 400 })
  }

  // Compose idempotency key: prefer top-level id (v2) else event + data.id (v1)
  const idempotencyKey: string = payload.id ?? (dataId ? `${eventType}:${dataId}` : null)
  if (!idempotencyKey) {
    console.warn('No idempotency key derivable from payload', payload)
    // Still process — but we can't dedupe. Better than silent drop.
  }

  const service = createServiceClient()

  if (idempotencyKey) {
    const { error: insertErr } = await service
      .from('webhook_events')
      .insert({ id: idempotencyKey, event: eventType, payload })

    if (insertErr) {
      if (insertErr.code === '23505') {
        console.log(`Duplicate webhook ${idempotencyKey} — ignoring`)
        return NextResponse.json({ status: 'duplicate' })
      }
      console.error('Failed to insert webhook event:', insertErr)
      return NextResponse.json({ error: 'storage failed' }, { status: 500 })
    }
  }

  try {
    await handleEvent(service, eventType, billing)
  } catch (err: any) {
    console.error(`Error handling ${eventType} (${idempotencyKey}):`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok' })
}

/**
 * Apply the tier change to the profile that owns this billing.
 * externalId is what we set on subscription creation — currently the Supabase user_id.
 */
async function handleEvent(
  service: ReturnType<typeof createServiceClient>,
  eventType: string,
  data: any
) {
  const userId = await resolveUserId(service, data)
  if (!userId) {
    console.warn(`${eventType}: could not resolve user from payload`, JSON.stringify(data).slice(0, 300))
    return
  }

  switch (eventType) {
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

    // Informational — subscription was created but may not be paid yet
    case 'subscription.created':
      console.log(`subscription.created for ${userId.slice(0, 8)} — awaiting billing.paid`)
      break

    // v2 events (forward-compat, in case AbacatePay upgrades this account later)
    case 'subscription.completed':
    case 'subscription.renewed': {
      const { data: profile } = await service
        .from('profiles')
        .select('pending_plan')
        .eq('id', userId)
        .single()
      const tier = profile?.pending_plan ?? 'pro'
      console.log(`✓ ${eventType} (v2): setting ${userId.slice(0, 8)} to ${tier}`)
      await service
        .from('profiles')
        .update({
          tier,
          subscription_status: 'active',
          pending_plan: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      break
    }

    default:
      console.log(`Ignoring event type: ${eventType}`)
  }
}

/**
 * Resolve the Supabase user_id from the webhook payload.
 *
 * Strategy (in priority order):
 *   1. data.externalId — if the API preserved our billing externalId (= user.id)
 *   2. metadata.user_id — if metadata survived
 *   3. Lookup profiles.subscription_id matching data.id (billing ID) — most reliable
 *      since we store the billing ID when creating the checkout
 */
async function resolveUserId(
  service: ReturnType<typeof createServiceClient>,
  data: any
): Promise<string | null> {
  // Direct match from payload
  const directId =
    data.externalId
    ?? data.billing?.externalId
    ?? data.subscription?.externalId
    ?? data.checkout?.externalId
    ?? data.metadata?.user_id
    ?? data.billing?.metadata?.user_id
    ?? null

  if (directId) return directId

  // Fallback: lookup by billing ID stored on profiles.subscription_id
  const billingId = data.billing?.id ?? data.id
  if (billingId) {
    const { data: profile } = await service
      .from('profiles')
      .select('id')
      .eq('subscription_id', billingId)
      .single()
    if (profile?.id) return profile.id
  }

  return null
}

/**
 * Two-way signature check:
 *   1. X-Webhook-Signature header containing HMAC-SHA256(body, secret) base64
 *   2. ?webhookSecret=... query string exactly matching secret
 * Passes if either matches. Both use constant-time compare.
 */
function verifySignature(req: NextRequest, rawBody: string, secret: string): boolean {
  const header = req.headers.get('x-webhook-signature')
  if (header) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
    if (constantTimeEqual(header, expected)) return true
  }

  const qsSecret = new URL(req.url).searchParams.get('webhookSecret')
  if (qsSecret && constantTimeEqual(qsSecret, secret)) return true

  return false
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}
