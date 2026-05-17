import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!rateLimit(`portal:${user.id}`, 5, 60_000))
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })

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
