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
      payment_method_types: ['card'],
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
