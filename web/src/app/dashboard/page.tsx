'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { t, type Locale } from '@/lib/i18n'
import { LocaleToggle } from '@/components/LocaleToggle'

type Profile = {
  email: string
  display_name: string | null
  tier: string
  current_period_end: string | null
  payment_provider: string | null
  stripe_customer_id: string | null
}

type Usage = {
  used: number
  limit: number
  remaining: number
  allowed: boolean
  tier: string
}

type Payment = {
  id: string
  amount: number
  plan: string
  paid_at: string
  provider: string
  currency: string
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false)
  const [locale, setLocale] = useState<Locale>('pt-br')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detect ?upgraded=true from AbacatePay completionUrl and show success banner
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeBanner(true)
      // Clean the URL after a tick so refresh doesn't re-show it
      const url = new URL(window.location.href)
      url.searchParams.delete('upgraded')
      window.history.replaceState({}, '', url.toString())
      // Re-fetch profile in case the webhook has already updated the tier
      const t = setTimeout(loadData, 1500)
      // Auto-dismiss after 6s
      const dismiss = setTimeout(() => setShowUpgradeBanner(false), 6000)
      return () => {
        clearTimeout(t)
        clearTimeout(dismiss)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadData = async () => {
    const cookieLocale = document.cookie.match(/locale=(pt-br|en)/)?.[1] as Locale | undefined
    const detected = cookieLocale ?? (navigator.language.startsWith('pt') ? 'pt-br' : 'en') as Locale
    setLocale(detected)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Load profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email, display_name, tier, current_period_end, payment_provider, stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileData) setProfile(profileData)

    // Check usage
    const { data: usageData } = await supabase.rpc('check_usage', { p_user_id: user.id })
    if (usageData) setUsage(usageData)

    // Load payment history
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, amount, plan, paid_at, provider, currency')
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false })
      .limit(12)

    if (paymentsData) setPayments(paymentsData)

    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
      </div>
    )
  }

  const tierNames: Record<string, string> = { free: t('tier.free', locale), pro: t('tier.pro', locale), unlimited: t('tier.unlimited', locale) }
  const tierColors: Record<string, string> = { free: '#8A8A8A', pro: '#7C3AED', unlimited: '#FF6B6B' }

  const usagePercent = usage && usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="border-b border-black/[0.04] bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
          </a>
          <div className="flex items-center gap-4">
            <LocaleToggle locale={locale} />
            <button onClick={handleLogout} className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">
              {t('dash.logout', locale)}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Upgrade success banner */}
        {showUpgradeBanner && (
          <div className="mb-6 bg-[#10B981]/10 border border-[#10B981]/30 text-[#065F46] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center text-white text-sm font-bold">
              ✓
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{t('banner.confirmed', locale)}</p>
              <p className="text-xs text-[#065F46]/80">
                {t('banner.updating', locale)}
              </p>
            </div>
            <button
              onClick={() => setShowUpgradeBanner(false)}
              className="text-[#065F46]/60 hover:text-[#065F46] text-lg leading-none"
              aria-label="fechar"
            >
              ×
            </button>
          </div>
        )}

        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {t('dash.greeting', locale)} {profile?.display_name || profile?.email?.split('@')[0]}
          </h1>
          <p className="text-[#8A8A8A]">{t('dash.subtitle', locale)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Plan Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest">{t('dash.yourPlan', locale)}</h2>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  color: tierColors[usage?.tier || 'free'],
                  background: `${tierColors[usage?.tier || 'free']}15`,
                }}
              >
                {tierNames[usage?.tier || 'free']}
              </span>
            </div>

            {usage?.tier === 'unlimited' ? (
              <p className="text-lg font-semibold text-[#1A1A1A]">{t('dash.unlimitedUses', locale)}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {usage?.used || 0}
                  </span>
                  <span className="text-[#8A8A8A] text-sm">/ {usage?.limit || 10} {t('dash.uses', locale)}</span>
                </div>
                <div className="w-full h-2 bg-[#F3F2EF] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(usagePercent, 100)}%`,
                      background: usagePercent > 80 ? '#FF6B6B' : '#7C3AED',
                    }}
                  />
                </div>
                <p className="text-xs text-[#8A8A8A]">
                  {usage?.remaining || 0} {t('dash.remaining', locale)} · {usage?.tier === 'free' ? t('dash.resetsDaily', locale) : t('dash.resetsMonthly', locale)}
                </p>
              </>
            )}

            {usage?.tier !== 'unlimited' && (
              <a href="/upgrade" className="inline-block mt-4 text-sm text-[#7C3AED] font-semibold hover:underline">
                {t('dash.upgrade', locale)} &rarr;
              </a>
            )}
            {profile?.payment_provider === 'stripe' && profile?.stripe_customer_id && usage?.tier !== 'free' && (
              <button
                onClick={openPortal}
                className="inline-block mt-2 text-sm text-[#8A8A8A] hover:text-[#1A1A1A] hover:underline transition"
              >
                {t('dash.manageSubscription', locale)} &rarr;
              </button>
            )}
          </div>

          {/* Account Card */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
            <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-4">{t('dash.yourAccount', locale)}</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#8A8A8A] mb-0.5">{t('dash.email', locale)}</p>
                <p className="text-sm font-medium">{profile?.email}</p>
              </div>
              <div>
                <p className="text-xs text-[#8A8A8A] mb-0.5">{t('dash.name', locale)}</p>
                <p className="text-sm font-medium">{profile?.display_name || '—'}</p>
              </div>
            </div>
          </div>

          {/* Download Card */}
          <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-6 text-white md:col-span-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{t('dash.download', locale)}</h2>
                <p className="text-white/70 text-sm">{t('dash.downloadDesc', locale)}</p>
              </div>
              <a href="https://dl.ticoai.app/TicoSetup.exe" className="bg-white text-[#5B21B6] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-100 transition flex items-center gap-2 shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                </svg>
                {t('dash.downloadBtn', locale)}
              </a>
            </div>
          </div>
        </div>

        {/* Next payment + Payments history */}
        {profile?.tier !== 'free' && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Next payment */}
            {profile?.current_period_end && (
              <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
                <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-4">{t('dash.nextPayment', locale)}</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {new Date(profile.current_period_end).toLocaleDateString('pt-BR', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </span>
                </div>
                <p className="text-xs text-[#8A8A8A] mt-2">
                  {profile?.payment_provider === 'stripe'
                    ? `${profile.tier === 'pro' ? '$9.99' : '$19.99'} \u00B7 ${t('dash.autoRenewal', locale)}`
                    : `${profile?.tier === 'pro' ? 'R$45,00' : 'R$99,90'} \u00B7 ${t('dash.autoRenewal', locale)}`
                  }
                </p>
              </div>
            )}

            {/* Payment history */}
            <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
              <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-4">{t('dash.payments', locale)}</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-[#8A8A8A]">{t('dash.noPayments', locale)}</p>
              ) : (
                <div className="space-y-3">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(p.paid_at).toLocaleDateString('pt-BR', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </p>
                        <p className="text-xs text-[#8A8A8A]">
                          {p.plan === 'pro' ? 'Tico Pro' : p.plan === 'unlimited' ? 'Tico Ilimitado' : p.plan}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[#1A1A1A]">
                        {p.currency === 'USD'
                          ? `$${(p.amount / 100).toFixed(2)}`
                          : `R$${(p.amount / 100).toFixed(2).replace('.', ',')}`
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        <div className="mt-5">
          <FeedbackCard email={profile?.email || ''} locale={locale} />
        </div>

        {/* App Token Section */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-200/80 p-6">
          <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-2">{t('dash.appToken', locale)}</h2>
          <p className="text-sm text-[#8A8A8A] mb-4">{t('dash.appTokenDesc', locale)}</p>
          <AppToken locale={locale} />
        </div>
      </main>
    </div>
  )
}

function AppToken({ locale }: { locale: Locale }) {
  const [token, setToken] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-[#F3F2EF] px-4 py-2.5 rounded-xl text-xs font-mono text-[#4A4A4A] overflow-hidden text-ellipsis whitespace-nowrap">
        {token ? `${token.slice(0, 40)}...` : t('dash.loading', locale)}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#1A1A1A] text-white hover:bg-gray-800 transition"
      >
        {copied ? t('dash.copied', locale) : t('dash.copy', locale)}
      </button>
    </div>
  )
}

function FeedbackCard({ email, locale }: { email: string; locale: Locale }) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleSend = async () => {
    if (!message.trim()) return
    setStatus('sending')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('error'); return }

    const { error } = await supabase
      .from('feedback')
      .insert({ user_id: user.id, email, message: message.trim() })

    if (error) {
      console.error('Feedback insert error:', error)
      setStatus('error')
    } else {
      setStatus('sent')
      setMessage('')
      setTimeout(() => setStatus('idle'), 4000)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-6">
      <h2 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-2">{t('dash.feedback', locale)}</h2>
      <p className="text-xs text-[#8A8A8A] mb-4">{t('dash.feedbackDesc', locale)}</p>

      {status === 'sent' ? (
        <div className="flex items-center gap-2 text-sm text-[#10B981] bg-[#10B981]/10 px-4 py-3 rounded-xl">
          <span>✓</span> {t('dash.feedbackSent', locale)}
        </div>
      ) : (
        <>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('dash.feedbackPlaceholder', locale)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-[#FAFAF8] resize-none mb-3"
          />
          <div className="flex items-center justify-between">
            {status === 'error' && (
              <p className="text-xs text-red-500">{t('dash.feedbackError', locale)}</p>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSend}
              disabled={!message.trim() || status === 'sending'}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#1A1A1A] text-white hover:bg-gray-800 transition disabled:opacity-40"
            >
              {status === 'sending' ? t('dash.feedbackSending', locale) : t('dash.feedbackSend', locale)}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
