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

        const subDetails = invoice.parent?.subscription_details
        const subscriptionId = typeof subDetails?.subscription === 'string'
          ? subDetails.subscription
          : subDetails?.subscription?.id ?? ''

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
