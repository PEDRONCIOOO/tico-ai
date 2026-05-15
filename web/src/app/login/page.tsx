'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  // Eye tracking — same logic as HeroTico on landing page
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
      const maxOffset = 3
      const ox = dist > 0 ? (dx / dist) * Math.min(maxOffset, dist * 0.04) : 0
      const oy = dist > 0 ? (dy / dist) * Math.min(maxOffset, dist * 0.04) : 0
      setEyeOffset({ x: ox, y: oy })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'email ou senha incorretos' : error.message)
      setLoading(false)
      return
    }

    router.push(redirect?.startsWith('/') ? redirect : '/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo with eye tracking */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div
            ref={ticoRef}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center"
          >
            <div className="flex gap-[4px]" style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>
              <div className="w-[4px] h-[4px] rounded-full bg-white shadow-[0_0_3px_rgba(255,255,255,0.8)]" />
              <div className="w-[4px] h-[4px] rounded-full bg-white shadow-[0_0_3px_rgba(255,255,255,0.8)]" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-sm">
          <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>entrar</h1>
          <p className="text-sm text-[#8A8A8A] mb-6">acesse sua conta do tico</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider block mb-1.5">email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-[#FAFAF8]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider block mb-1.5">senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-[#FAFAF8]"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? 'entrando...' : 'entrar'}
            </button>
          </form>

          <p className="text-center text-sm text-[#8A8A8A] mt-6">
            não tem conta? <Link href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'} className="text-[#7C3AED] font-medium hover:underline">criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
