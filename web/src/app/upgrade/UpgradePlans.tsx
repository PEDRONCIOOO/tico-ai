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
                    {locale === 'en' && plan.priceUSD ? plan.priceUSD : plan.priceBRL}
                  </span>
                  <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-[#8A8A8A]'}`}>
                    {t(plan.periodKey, locale)}
                  </span>
                </div>
                {plan.priceUSD && (
                  <p className={`text-sm mt-0.5 ${plan.highlight ? 'text-gray-400' : 'text-[#8A8A8A]'}`}>
                    {locale === 'en' ? plan.priceBRL : plan.priceUSD}{t(plan.periodKey, locale)}
                  </p>
                )}
              </div>

              <div className={`w-full h-px my-5 ${plan.highlight ? 'bg-white/10' : 'bg-gray-100'}`} />

              <ul className="space-y-3 mb-7">
                {plan.featureKeys.map((key, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                    <span className={`mt-0.5 text-xs ${plan.highlight ? 'text-[#FBBF24]' : 'text-[#7C3AED]'}`}>&#x25CF;</span>
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
                    {isLoadingPix ? t('btn.redirecting', locale) : `PIX \u00B7 ${plan.priceBRL}`}
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
                    {isLoadingCard ? t('btn.redirecting', locale) : `Card \u00B7 ${plan.priceUSD}`}
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
