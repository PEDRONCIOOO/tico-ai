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
