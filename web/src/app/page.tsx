'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { t, type Locale } from '@/lib/i18n'
import { LocaleToggle } from '@/components/LocaleToggle'

const DOWNLOAD_URL = 'https://dl.ticoai.app/TicoSetup.exe'

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
    <div className="fixed pointer-events-none z-[999]" style={{ left: buddyPos.x - 15, top: buddyPos.y - 15 }}>
      <div className="relative">
        <div className="absolute -inset-2.5 rounded-full bg-purple-500/15 blur-xl" />
        <div className="relative w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-[0_4px_24px_rgba(124,58,237,0.35)] flex items-center justify-center">
          <div className="flex gap-[5px]" style={{ transform: `translate(${ex}px, ${ey}px)` }}>
            <div className="w-[5px] h-[5px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
            <div className="w-[5px] h-[5px] rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── System Clock (live clock for nav tray) ─────────────────────
function SystemClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return <span>{time}</span>
}

// ─── Windows Window Frame ────────────────────────────────────────
function WinFrame({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`win-frame rounded-lg border border-gray-300/80 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden ${className}`}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-[#F3F2EF] to-[#E8E6E1] border-b border-gray-200/80">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#7C3AED]" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
          <span className="text-[11px] text-[#8A8A8A] font-mono truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-300/80 flex items-center justify-center">
            <span className="text-[8px] text-gray-500 leading-none">─</span>
          </div>
          <div className="w-3 h-3 rounded-sm bg-gray-300/80 flex items-center justify-center">
            <span className="text-[8px] text-gray-500 leading-none">□</span>
          </div>
          <div className="w-3 h-3 rounded-sm bg-red-400/80 flex items-center justify-center">
            <span className="text-[8px] text-white leading-none">×</span>
          </div>
        </div>
      </div>
      {/* Content */}
      {children}
    </div>
  )
}

// ─── Draggable Element ───────────────────────────────────────────
function Draggable({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = ref.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y }
  }, [offset])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset({ x: dragState.current.origX + dx, y: dragState.current.origY + dy })
  }, [])

  const onPointerUp = useCallback(() => {
    dragState.current.dragging = false
  }, [])

  return (
    <div
      ref={ref}
      className={`absolute touch-none select-none cursor-grab active:cursor-grabbing z-10 transition-shadow hover:shadow-lg ${className}`}
      style={{ ...style, transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  )
}

// ─── Hero Floating Elements (Windows desktop items) ──────────────
function HeroFloatingElements() {
  return (
    <div className="hidden lg:block absolute inset-0 overflow-hidden pointer-events-none">
      {/* Recycle Bin — top left */}
      <Draggable className="pointer-events-auto" style={{ top: '15%', left: '5%' }}>
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/50 transition">
          <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
            <rect x="12" y="14" width="24" height="28" rx="2" fill="#E8E6E1" stroke="#B0ADA8" strokeWidth="1.5" />
            <rect x="10" y="10" width="28" height="5" rx="1.5" fill="#B0ADA8" />
            <rect x="20" y="7" width="8" height="4" rx="1" fill="#B0ADA8" />
            <line x1="19" y1="20" x2="19" y2="36" stroke="#B0ADA8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="24" y1="20" x2="24" y2="36" stroke="#B0ADA8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="29" y1="20" x2="29" y2="36" stroke="#B0ADA8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px] text-[#8A8A8A] font-mono">lixeira</span>
        </div>
      </Draggable>

      {/* Folder — top right */}
      <Draggable className="pointer-events-auto" style={{ top: '12%', right: '6%' }}>
        <div className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/50 transition">
          <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
            <path d="M6 14h14l4-4h18a2 2 0 012 2v26a2 2 0 01-2 2H6a2 2 0 01-2-2V16a2 2 0 012-2z" fill="#FBBF24" stroke="#D4A017" strokeWidth="1.2" />
            <path d="M4 18h40v20a2 2 0 01-2 2H6a2 2 0 01-2-2V18z" fill="#FCD34D" />
          </svg>
          <span className="text-[10px] text-[#8A8A8A] font-mono">meus arquivos</span>
        </div>
      </Draggable>

      {/* Kaomoji ^ω^ — left side */}
      <Draggable className="pointer-events-auto" style={{ top: '50%', left: '3%' }}>
        <span className="text-2xl font-mono text-[#C4C4C4] hover:text-[#7C3AED] transition-colors select-none">{'^ω^'}</span>
      </Draggable>

      {/* "olá meu nome é" sticker — right side */}
      <Draggable className="pointer-events-auto" style={{ top: '45%', right: '4%' }}>
        <div className="w-[140px] rotate-3">
          <div className="bg-white rounded-lg border-2 border-red-400 shadow-md overflow-hidden">
            <div className="bg-red-400 px-3 py-1">
              <p className="text-[8px] text-white font-bold uppercase tracking-wider text-center">ola, meu nome e</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-xl font-bold text-[#7C3AED]" style={{ fontFamily: 'Bricolage Grotesque' }}>tico</p>
            </div>
          </div>
        </div>
      </Draggable>

      {/* Kaomoji (•‿•) — bottom left */}
      <Draggable className="pointer-events-auto" style={{ bottom: '25%', left: '8%' }}>
        <span className="text-xl font-mono text-[#C4C4C4] hover:text-[#7C3AED] transition-colors select-none">{'(•‿•)'}</span>
      </Draggable>

      {/* Classic Windows cursor — bottom right */}
      <Draggable className="pointer-events-auto" style={{ bottom: '20%', right: '8%' }}>
        <svg className="w-8 h-10 drop-shadow-md" viewBox="0 0 28 36" fill="none">
          <path d="M2 2L2 28L8.5 21.5L14 33L18 31L12.5 19.5L22 19.5L2 2Z" fill="white" stroke="#1A1A1A" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </Draggable>

      {/* Mini notepad window — left mid */}
      <Draggable className="pointer-events-auto" style={{ top: '30%', left: '2%' }}>
        <div className="w-[150px] rounded-md border border-gray-300/80 bg-white shadow-md overflow-hidden -rotate-2">
          <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-[#F3F2EF] to-[#E8E6E1] border-b border-gray-200/80">
            <span className="text-[9px] text-[#8A8A8A] font-mono">notas.txt</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gray-300/80" />
              <div className="w-2 h-2 rounded-sm bg-gray-300/80" />
              <div className="w-2 h-2 rounded-sm bg-red-400/80" />
            </div>
          </div>
          <div className="px-2 py-2 text-[10px] text-[#4A4A4A] font-mono leading-relaxed">
            todo: dominar o mundo<br />
            (com ajuda do tico)
          </div>
        </div>
      </Draggable>

      {/* Kaomoji ¯\_(ツ)_/¯ — right mid-bottom */}
      <Draggable className="pointer-events-auto" style={{ bottom: '35%', right: '3%' }}>
        <span className="text-lg font-mono text-[#C4C4C4] hover:text-[#7C3AED] transition-colors select-none">{'¯\\_(ツ)_/¯'}</span>
      </Draggable>
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
function PricingCard({ tier, price, period, features, highlight, cta, href, popularLabel }: {
  tier: string; price: string; period: string; features: string[]; highlight?: boolean; cta: string; href: string; popularLabel?: string
}) {
  return (
    <div className={`relative group rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 ${
      highlight
        ? 'bg-[#1A1A1A] text-white shadow-[0_8px_40px_rgba(124,58,237,0.25)]'
        : 'bg-white border border-gray-200/80 hover:shadow-xl'
    }`}>
      {highlight && popularLabel && (
        <div className="absolute -top-3 left-6 bg-[#FF6B6B] text-white text-[11px] font-bold tracking-wide uppercase px-3 py-1 rounded-full">
          {popularLabel}
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

// ─── FAQ Item ────────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-gray-200/70 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
      >
        <span className={`text-[15px] font-medium ${open ? 'text-[#7C3AED]' : 'text-[#1A1A1A]'}`}>{question}</span>
        <span className={`text-lg transition-transform duration-200 ${open ? 'rotate-45 text-[#7C3AED]' : 'text-[#8A8A8A]'}`}>+</span>
      </button>
      {open && (
        <div className="px-6 pb-4 text-[14px] text-[#4A4A4A] leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

// ─── Active Users Counter ────────────────────────────────────────
function ActiveUsersCounter({ locale }: { locale: Locale }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => { if (d.users) setCount(d.users) })
      .catch(() => {})
  }, [])

  if (count === null) return null

  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-full px-4 py-2 shadow-sm animate-in delay-5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
      </span>
      <span className="text-[13px] text-[#4A4A4A] font-medium">
        <span className="font-bold text-[#1A1A1A]">{count.toLocaleString()}+</span> {t('hero.activeUsers', locale)}
      </span>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function Home() {
  const [authed, setAuthed] = useState(false)
  const [locale, setLocale] = useState<Locale>('pt-br')
  const [annual, setAnnual] = useState(false)

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

          {/* System tray — retro Windows feel */}
          <div className="hidden md:flex items-center gap-2 bg-[#F3F2EF] border border-gray-200/80 rounded-md px-3 py-1 text-[11px] text-[#8A8A8A] font-mono select-none">
            <span>
              <svg className="w-3 h-3 inline-block mr-1 -mt-px" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
            </span>
            <span className="text-[#10B981] font-semibold">{t('nav.trayOnline', locale)}</span>
            <span className="text-[#C4C4C4]">|</span>
            <SystemClock />
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition hidden sm:block">{t('nav.features', locale)}</a>
            <a href="#pricing" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition hidden sm:block">{t('nav.plans', locale)}</a>
            <a href="/updates" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition hidden sm:block">{t('nav.updates', locale)}</a>
            <AuthNavButton locale={locale} />
            <LocaleToggle locale={locale} />
            <a href={DOWNLOAD_URL} className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
              {t('nav.download', locale)}
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-14 relative">
        <HeroFloatingElements />
        <div className="max-w-6xl mx-auto px-6 w-full relative">
          <div className="text-center pt-16 lg:pt-24 pb-12">
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
            <p className="animate-in delay-2 text-lg text-[#4A4A4A] max-w-lg leading-relaxed mb-8 mx-auto">
              {t('hero.desc', locale)}
            </p>
            <div className="animate-in delay-3 flex flex-wrap items-center justify-center gap-3">
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
            <div className="animate-in delay-4 flex flex-col items-center gap-3 mt-4">
              <p className="text-[11px] text-[#8A8A8A] tracking-wide">
                {t('hero.note', locale)}
              </p>
              <ActiveUsersCounter locale={locale} />
            </div>
          </div>

          {/* Demo Video — Windows window frame */}
          <div className="animate-in delay-4 relative max-w-4xl mx-auto mb-16">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#7C3AED]/15 to-[#A78BFA]/15 blur-2xl" />
            <WinFrame title="TicoPresentation.mp4">
              <video
                className="w-full"
                controls
                muted
                autoPlay
                playsInline
                loop
              >
                <source src="https://tzpwebrpnqqygzpqxznb.supabase.co/storage/v1/object/public/public-assets/TicoPresentation.mp4" type="video/mp4" />
              </video>
            </WinFrame>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <div className="py-8 border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-[13px] text-[#8A8A8A]">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#7C3AED]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            {t('trust.poweredBy', locale)}
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#7C3AED]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            {t('trust.encrypted', locale)}
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#7C3AED]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            {t('trust.madeIn', locale)}
          </span>
        </div>
      </div>

      {/* Manifesto — "a ideia" */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6">
          <WinFrame title="a-ideia.txt">
            <div className="px-6 py-6 md:px-8 md:py-8 bg-[#FFFEF9]">
              <h2 className="text-xl font-bold tracking-tight mb-5 text-[#7C3AED] lowercase" style={{ fontFamily: 'Bricolage Grotesque' }}>
                {t('manifesto.title', locale)}
              </h2>
              <div className="text-[14px] text-[#4A4A4A] leading-relaxed space-y-3 font-mono">
                {t('manifesto.text', locale).split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{t('manifesto.author', locale)}</p>
                  <a href="https://www.linkedin.com/company/ticoai" target="_blank" rel="noopener noreferrer" className="text-xs text-[#7C3AED] hover:underline">
                    linkedin/ticoai
                  </a>
                </div>
              </div>
            </div>
          </WinFrame>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureItems.map((item, i) => {
              const filenames = ['tico-davinci.mp4', 'tico-copy.mp4', 'tico-afterfx.mp4', 'tico-figma.mp4', 'tico-vscode.mp4', 'tico-darkmode.mp4']
              return (
                <div key={i} className="group rounded-lg border border-gray-300/80 bg-white shadow-sm hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 overflow-hidden">
                  {/* Mini title bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-[#F3F2EF] to-[#E8E6E1] border-b border-gray-200/80">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/40" />
                      <span className="text-[9px] text-[#8A8A8A] font-mono">{filenames[i]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                      <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                      <div className="w-2 h-2 rounded-sm bg-red-300/60" />
                    </div>
                  </div>
                  {/* Content */}
                  <div className="px-5 py-4">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[#7C3AED] mb-2 block">{t(item.tagKey, locale)}</span>
                    <p className="text-[15px] text-[#4A4A4A] leading-relaxed italic">{t(item.textKey, locale)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[#F3F2EF]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4" style={{ fontFamily: 'Bricolage Grotesque' }}>{t('how.title', locale)}</h2>
          <p className="text-center text-[#8A8A8A] text-sm font-mono mb-14">{'(•‿•) →'} F8 {'→ ✨'}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((item, i) => {
              const stepFiles = ['01-falar.exe', '02-contexto.exe', '03-guiar.exe']
              return (
                <div key={i} className="rounded-lg border border-gray-300/80 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-[#F3F2EF] to-[#E8E6E1] border-b border-gray-200/80">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-[#7C3AED]/60" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" /></svg>
                      <span className="text-[9px] text-[#8A8A8A] font-mono">{stepFiles[i]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                      <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                      <div className="w-2 h-2 rounded-sm bg-red-300/60" />
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <span className="text-4xl font-black text-[#7C3AED]/10 block mb-2" style={{ fontFamily: 'Bricolage Grotesque' }}>
                      {item.step}
                    </span>
                    <h3 className="text-lg font-bold mb-2">{t(item.titleKey, locale)}</h3>
                    <p className="text-[15px] text-[#8A8A8A] leading-relaxed">{t(item.descKey, locale)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Marquee banner */}
      <div className="py-4 bg-[#1A1A1A] overflow-hidden select-none">
        <div className="animate-marquee flex whitespace-nowrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="mx-8 text-sm font-bold tracking-widest uppercase text-white/60">
              {t('marquee.text', locale)} {'·'} {'(•‿•)'} {'·'}
            </span>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-4" style={{ fontFamily: 'Bricolage Grotesque' }}>
            {t('testimonials.title', locale)}
          </h2>
          <p className="text-center text-[#8A8A8A] text-sm mb-14 font-mono">
            {'¯\\_(ツ)_/¯'} {locale === 'pt-br' ? 'nao acredita? pergunta pra eles' : "don't believe us? ask them"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-gray-300/80 bg-white shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
                {/* Mini title bar */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-[#F3F2EF] to-[#E8E6E1] border-b border-gray-200/80">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    <span className="text-[9px] text-[#8A8A8A] font-mono">depoimento-{String(i).padStart(2, '0')}.txt</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                    <div className="w-2 h-2 rounded-sm bg-gray-300/60" />
                    <div className="w-2 h-2 rounded-sm bg-red-300/60" />
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-2xl text-[#7C3AED]/20 font-serif mb-2">&ldquo;</div>
                  <p className="text-[14px] text-[#4A4A4A] leading-relaxed mb-5 italic">
                    {t(`testimonials.${i}.quote`, locale)}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{t(`testimonials.${i}.name`, locale)[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{t(`testimonials.${i}.name`, locale)}</p>
                      <p className="text-xs text-[#8A8A8A]">{t(`testimonials.${i}.role`, locale)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Bricolage Grotesque' }}>{t('pricing.title', locale)}</h2>
            <p className="text-[#8A8A8A] text-lg">{t('pricing.subtitle', locale)}</p>
          </div>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-medium ${!annual ? 'text-[#1A1A1A]' : 'text-[#8A8A8A]'}`}>{t('pricing.monthly', locale)}</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${annual ? 'bg-[#7C3AED]' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-sm font-medium ${annual ? 'text-[#1A1A1A]' : 'text-[#8A8A8A]'}`}>{t('pricing.annual', locale)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            <PricingCard tier={t('plan.free', locale)} price={locale === 'en' ? '$0' : 'R$0'} period={t('plan.forever', locale)}
              features={[t('feat.10day', locale), t('feat.voice', locale), t('feat.cursor', locale), t('feat.sonnet', locale)]}
              cta={t('pricing.cta.free', locale)} href={DOWNLOAD_URL} />
            <PricingCard tier={t('plan.pro', locale)}
              price={locale === 'en' ? (annual ? '$7.99' : '$9.99') : (annual ? 'R$36' : 'R$45')}
              period={annual ? (locale === 'en' ? '/mo billed yearly' : '/mes cobrado anual') : t('plan.perMonth', locale)}
              highlight popularLabel={t('btn.popular', locale)}
              features={[t('feat.500month', locale), t('feat.voice', locale), t('feat.cursorPointing', locale), t('feat.sonnet', locale), t('feat.priority', locale)]}
              cta={t('pricing.cta.pro', locale)} href={subscribeHref} />
            <PricingCard tier={t('plan.unlimited', locale)}
              price={locale === 'en' ? (annual ? '$15.99' : '$19.99') : (annual ? 'R$79,90' : 'R$99,90')}
              period={annual ? (locale === 'en' ? '/mo billed yearly' : '/mes cobrado anual') : t('plan.perMonth', locale)}
              features={[t('feat.unlimited', locale), t('feat.voice', locale), t('feat.cursorPointing', locale), t('feat.opus', locale), t('feat.priority', locale), t('feat.earlyAccess', locale)]}
              cta={t('pricing.cta.unlimited', locale)} href={subscribeHref} />
          </div>
          <p className="text-center text-[12px] text-[#8A8A8A] mt-6 font-mono">{t('pricing.microcopy', locale)}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-[#F3F2EF]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-3" style={{ fontFamily: 'Bricolage Grotesque' }}>
            {t('faq.title', locale)}
          </h2>
          <p className="text-center text-[#8A8A8A] text-sm font-mono mb-12">
            {locale === 'pt-br' ? 'sem letra miuda, sem pegadinha' : 'no fine print, no gotchas'} {'^ω^'}
          </p>
          <WinFrame title="faq.txt">
            <div className="p-4 md:p-6 space-y-3 bg-[#FFFEF9]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <FaqItem key={i} question={t(`faq.${i}.q`, locale)} answer={t(`faq.${i}.a`, locale)} />
              ))}
            </div>
          </WinFrame>
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
            <p className="text-white/40 text-sm font-mono mb-4 relative">{'(•‿•)'}</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 relative" style={{ fontFamily: 'Bricolage Grotesque' }}>
              {t('cta.title', locale)}
            </h2>
            <p className="text-white/70 text-lg mb-3 max-w-md mx-auto relative">
              {t('cta.desc', locale)}
            </p>
            <p className="text-white/40 text-xs font-mono mb-8 relative">
              {locale === 'pt-br' ? 'sem plugin, sem integracao — so apertar F8.' : 'no plugins, no setup — just press F8.'}
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
      <footer className="py-12 border-t border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                  <div className="flex gap-[2px]">
                    <div className="w-[2px] h-[2px] rounded-full bg-white" />
                    <div className="w-[2px] h-[2px] rounded-full bg-white" />
                  </div>
                </div>
                <span className="text-[14px] font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque' }}>tico</span>
              </div>
              <p className="text-[12px] text-[#8A8A8A] leading-relaxed">
                {t('footer.credit', locale)} <a className="text-[#7C3AED] hover:underline" href="https://ticoai.app" target="_blank">{t('footer.team', locale)}</a><br />
                {t('footer.tagline', locale)}
              </p>
            </div>

            {/* Produto */}
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#8A8A8A] mb-3">{t('footer.product', locale)}</p>
              <div className="space-y-2">
                <a href="#features" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('nav.features', locale)}</a>
                <a href="#pricing" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('nav.plans', locale)}</a>
                <a href="/updates" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('nav.updates', locale)}</a>
              </div>
            </div>

            {/* Recursos */}
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#8A8A8A] mb-3">{t('footer.resources', locale)}</p>
              <div className="space-y-2">
                <a href="/privacy" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('footer.privacy', locale)}</a>
                <a href="/terms" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('footer.terms', locale)}</a>
                <a href="mailto:support@ticoai.app" className="block text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">{t('footer.support', locale)}</a>
              </div>
            </div>

            {/* Conectar */}
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-[#8A8A8A] mb-3">{t('footer.connect', locale)}</p>
              <div className="space-y-2">
                <a href="https://www.linkedin.com/company/ticoai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  LinkedIn
                </a>
                <a href="https://instagram.com/ticoai.app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-[#4A4A4A] hover:text-[#7C3AED] transition">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </a>
              </div>
            </div>
          </div>

          {/* Privacy disclaimer + bottom bar */}
          <div className="border-t border-gray-200/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-[#8A8A8A] font-mono flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[#10B981]" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              {t('footer.privacyNote', locale)}
            </p>
            <p className="text-[11px] text-[#C4C4C4]">&copy; {new Date().getFullYear()} tico</p>
          </div>
        </div>
      </footer>
    </>
  )
}
