'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { t, type Locale } from '@/lib/i18n'
import { LocaleToggle } from '@/components/LocaleToggle'

const DOWNLOAD_URL = 'https://github.com/pfrfromperu/tico/releases/latest/download/TicoSetup.exe'

// ─── Tico Buddy Component (follows cursor) ───────────────────────
function TicoBuddy() {
  const [buddyPos, setBuddyPos] = useState({ x: -100, y: -100 })
  const [visible, setVisible] = useState(false)
  const buddyRef = useRef({ x: -100, y: -100, vx: 0, vy: 0 })
  const mouseRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      if (!visible) setVisible(true)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [visible])

  useEffect(() => {
    let lastTime = performance.now()
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time
      const b = buddyRef.current
      const tx = mouseRef.current.x + 30
      const ty = mouseRef.current.y + 20
      const fx = 220 * (tx - b.x) - 16 * b.vx
      const fy = 220 * (ty - b.y) - 16 * b.vy
      b.vx += fx * dt
      b.vy += fy * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      setBuddyPos({ x: b.x, y: b.y })
      frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const ex = Math.max(-3, Math.min(3, buddyRef.current.vx * 0.015))
  const ey = Math.max(-3, Math.min(3, buddyRef.current.vy * 0.015))

  if (!visible) return null

  return (
    <div className="fixed pointer-events-none z-[999]" style={{ left: buddyPos.x - 20, top: buddyPos.y - 20 }}>
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-purple-500/15 blur-xl" />
        <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-[0_4px_24px_rgba(124,58,237,0.35)] flex items-center justify-center">
          <div className="flex gap-[7px]" style={{ transform: `translate(${ex}px, ${ey}px)` }}>
            <div className="w-[5px] h-[5px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
            <div className="w-[5px] h-[5px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero Tico (large decorative) ────────────────────────────────
function HeroTico({ locale }: { locale: Locale }) {
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 })
  const ticoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticoRef.current) return
      const rect = ticoRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxOffset = 10
      const ox = dist > 0 ? (dx / dist) * Math.min(maxOffset, dist * 0.06) : 0
      const oy = dist > 0 ? (dy / dist) * Math.min(maxOffset, dist * 0.06) : 0
      setEyeOffset({ x: ox, y: oy })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="animate-float relative" ref={ticoRef}>
      <div className="absolute -inset-8 rounded-full bg-purple-400/10 blur-3xl" />
      <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-full bg-gradient-to-br from-[#7C3AED] via-[#9333EA] to-[#A78BFA] shadow-[0_12px_60px_rgba(124,58,237,0.3)] flex items-center justify-center">
        <div className="flex gap-5 md:gap-7" style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>
          <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
          <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
        </div>
      </div>
      <div className="absolute -top-4 -right-24 md:-right-32 bg-white rounded-2xl rounded-bl-sm px-4 py-2 shadow-lg animate-in delay-5">
        <p className="text-sm font-medium text-[#1A1A1A]">{t('hero.bubble', locale)}</p>
      </div>
    </div>
  )
}

// ─── Pricing Card ────────────────────────────────────────────────
function PricingCard({ tier, price, period, features, highlight, cta, href }: {
  tier: string; price: string; period: string; features: string[]; highlight?: boolean; cta: string; href: string
}) {
  return (
    <div className={`relative group rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 ${
      highlight
        ? 'bg-[#1A1A1A] text-white shadow-[0_8px_40px_rgba(124,58,237,0.25)]'
        : 'bg-white border border-gray-200/80 hover:shadow-xl'
    }`}>
      {highlight && (
        <div className="absolute -top-3 left-6 bg-[#FF6B6B] text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-full">
          popular
        </div>
      )}
      <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${highlight ? 'text-purple-300' : 'text-[#8A8A8A]'}`}>
        {tier}
      </p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque' }}>
          {price}
        </span>
        <span className={`text-sm ${highlight ? 'text-gray-400' : 'text-[#8A8A8A]'}`}>{period}</span>
      </div>
      <div className={`w-full h-px my-5 ${highlight ? 'bg-white/10' : 'bg-gray-100'}`} />
      <ul className="space-y-3 mb-7">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
            <span className={`mt-0.5 text-xs ${highlight ? 'text-[#FBBF24]' : 'text-[#7C3AED]'}`}>●</span>
            <span className={highlight ? 'text-gray-300' : 'text-[#4A4A4A]'}>{f}</span>
          </li>
        ))}
      </ul>
      <a href={href} className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${
        highlight
          ? 'bg-[#7C3AED] text-white hover:bg-[#5B21B6] shadow-lg shadow-purple-500/20'
          : 'bg-[#F3F2EF] text-[#1A1A1A] hover:bg-gray-200'
      }`}>
        {cta}
      </a>
    </div>
  )
}

// ─── Auth-aware nav button ───────────────────────────────────────
function AuthNavButton({ locale }: { locale: Locale }) {
  const [status, setStatus] = useState<'loading' | 'in' | 'out'>('loading')

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setStatus(data.user ? 'in' : 'out')
    })
    return () => {
      mounted = false
    }
  }, [])

  if (status === 'loading') {
    return <span className="text-[13px] hidden sm:inline-block w-[44px]" aria-hidden />
  }

  if (status === 'in') {
    return (
      <a href="/dashboard" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">
        {t('nav.profile', locale)}
      </a>
    )
  }

  return (
    <a href="/login" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">
      {t('nav.login', locale)}
    </a>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [locale, setLocale] = useState<Locale>('pt-br')

  useEffect(() => {
    const cookieLocale = document.cookie.match(/locale=(pt-br|en)/)?.[1] as Locale | undefined
    const detected = cookieLocale ?? (navigator.language.startsWith('pt') ? 'pt-br' : 'en') as Locale
    setLocale(detected)

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAuthed(true)
    })
  }, [])

  const subscribeHref = authed ? '/upgrade' : '/login?redirect=/upgrade'

  const featureItems = [
    { tagKey: 'features.video.tag', textKey: 'features.video.text' },
    { tagKey: 'features.writing.tag', textKey: 'features.writing.text' },
    { tagKey: 'features.learning.tag', textKey: 'features.learning.text' },
    { tagKey: 'features.design.tag', textKey: 'features.design.text' },
    { tagKey: 'features.code.tag', textKey: 'features.code.text' },
    { tagKey: 'features.nav.tag', textKey: 'features.nav.text' },
  ]

  const steps = [
    { step: '01', titleKey: 'how.step1.title', descKey: 'how.step1.desc' },
    { step: '02', titleKey: 'how.step2.title', descKey: 'how.step2.desc' },
    { step: '03', titleKey: 'how.step3.title', descKey: 'how.step3.desc' },
  ]

  return (
    <>
      <TicoBuddy />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#FAFAF8]/80 border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque' }}>tico</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition hidden sm:block">{t('nav.features', locale)}</a>
            <a href="#pricing" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition hidden sm:block">{t('nav.plans', locale)}</a>
            <AuthNavButton locale={locale} />
            <LocaleToggle locale={locale} />
            <a href={DOWNLOAD_URL} className="bg-[#1A1A1A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
              {t('nav.download', locale)}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — Asymmetric */}
      <section className="min-h-screen pt-14 flex items-center">
        <div className="max-w-6xl mx-auto px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-16 items-center">
            <div className="lg:col-span-3 pt-12 lg:pt-0">
              <div className="animate-in">
                <span className="inline-block bg-[#7C3AED]/8 text-[#7C3AED] text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6 border border-[#7C3AED]/15">
                  {t('hero.badge', locale)}
                </span>
              </div>
              <h1 className="animate-in delay-1 text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.05] tracking-tight mb-6" style={{ fontFamily: 'Bricolage Grotesque' }}>
                {t('hero.title1', locale)}<br />
                <span className="bg-gradient-to-r from-[#7C3AED] to-[#FF6B6B] bg-clip-text text-transparent">
                  {t('hero.title2', locale)}
                </span>
              </h1>
              <p className="animate-in delay-2 text-lg text-[#4A4A4A] max-w-lg leading-relaxed mb-8">
                {t('hero.desc', locale)}
              </p>
              <div className="animate-in delay-3 flex flex-wrap items-center gap-3">
                <a href={DOWNLOAD_URL} className="inline-flex items-center gap-2.5 bg-[#1A1A1A] text-white px-7 py-3.5 rounded-xl font-semibold text-[15px] hover:bg-gray-800 transition shadow-lg shadow-black/10">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                  {t('hero.downloadBtn', locale)}
                </a>
                <a href="#pricing" className="text-[15px] text-[#8A8A8A] hover:text-[#7C3AED] font-medium transition px-4 py-3.5">
                  {t('hero.seePlans', locale)}
                </a>
              </div>
              <p className="animate-in delay-4 text-[11px] text-[#8A8A8A] mt-4 tracking-wide">
                {t('hero.note', locale)}
              </p>
            </div>
            <div className="lg:col-span-2 flex justify-center lg:justify-end animate-in delay-3">
              <HeroTico locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-xl mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Bricolage Grotesque' }}>
              {t('features.title', locale)}
            </h2>
            <p className="text-[#8A8A8A] text-lg">
              {t('features.subtitle', locale)}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featureItems.map((item, i) => (
              <div key={i}
                className="group relative bg-white border border-gray-200/70 rounded-2xl px-6 py-5 hover:border-[#7C3AED]/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300"
              >
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#7C3AED] mb-2 block">{t(item.tagKey, locale)}</span>
                <p className="text-[15px] text-[#4A4A4A] leading-relaxed italic">{t(item.textKey, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[#F3F2EF]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-16" style={{ fontFamily: 'Bricolage Grotesque' }}>{t('how.title', locale)}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <div key={i}>
                <span className="text-5xl font-black text-[#7C3AED]/10 block mb-3" style={{ fontFamily: 'Bricolage Grotesque' }}>
                  {item.step}
                </span>
                <h3 className="text-lg font-bold mb-2">{t(item.titleKey, locale)}</h3>
                <p className="text-[15px] text-[#8A8A8A] leading-relaxed">{t(item.descKey, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Bricolage Grotesque' }}>{t('pricing.title', locale)}</h2>
            <p className="text-[#8A8A8A] text-lg">{t('pricing.subtitle', locale)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <PricingCard tier={t('plan.free', locale)} price="R$0" period={t('plan.forever', locale)}
              features={[t('feat.10day', locale), t('feat.voice', locale), t('feat.cursor', locale), t('feat.sonnet', locale)]}
              cta={t('pricing.cta.free', locale)} href={DOWNLOAD_URL} />
            <PricingCard tier={t('plan.pro', locale)} price="R$45" period={t('plan.perMonth', locale)} highlight
              features={[t('feat.500month', locale), t('feat.voice', locale), t('feat.cursorPointing', locale), t('feat.sonnet', locale), t('feat.priority', locale)]}
              cta={t('pricing.cta.pro', locale)} href={subscribeHref} />
            <PricingCard tier={t('plan.unlimited', locale)} price="R$99,90" period={t('plan.perMonth', locale)}
              features={[t('feat.unlimited', locale), t('feat.voice', locale), t('feat.cursorPointing', locale), t('feat.opus', locale), t('feat.priority', locale), t('feat.earlyAccess', locale)]}
              cta={t('pricing.cta.unlimited', locale)} href={subscribeHref} />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-3xl px-8 py-16 md:py-20 relative overflow-hidden">
            <div className="absolute top-8 left-8 w-24 h-24 rounded-full border border-white/10" />
            <div className="absolute bottom-12 right-12 w-36 h-36 rounded-full border border-white/10" />
            <div className="absolute top-1/2 left-1/4 w-3 h-3 rounded-full bg-white/20" />
            <div className="absolute top-1/3 right-1/3 w-2 h-2 rounded-full bg-white/15" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 relative" style={{ fontFamily: 'Bricolage Grotesque' }}>
              {t('cta.title', locale)}
            </h2>
            <p className="text-white/70 text-lg mb-8 max-w-md mx-auto relative">
              {t('cta.desc', locale)}
            </p>
            <a href={DOWNLOAD_URL} className="relative inline-flex items-center gap-2.5 bg-white text-[#5B21B6] px-8 py-4 rounded-xl font-bold text-[15px] hover:bg-gray-100 transition shadow-xl">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
              </svg>
              {t('cta.btn', locale)}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[2px]">
                <div className="w-[2px] h-[2px] rounded-full bg-white" />
                <div className="w-[2px] h-[2px] rounded-full bg-white" />
              </div>
            </div>
            <span className="text-[13px] font-semibold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque' }}>tico</span>
          </div>
          <p className="text-[12px] text-[#8A8A8A]">{t('footer.credit', locale)} <a className='text-blue-500' href="https://ticoai.app" target='_blank'>{t('footer.team', locale)}</a> {t('footer.tagline', locale)}</p>
        </div>
      </footer>
    </>
  )
}
