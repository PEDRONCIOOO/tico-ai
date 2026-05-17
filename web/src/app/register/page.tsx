'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}

function RegisterContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password.length < 8) {
      setError('a senha precisa ter pelo menos 8 caracteres')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('as senhas nao coincidem')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setRegistered(true)
    setLoading(false)
  }

  if (registered) {
    return <VerifyEmailScreen email={email} />
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <div className="flex gap-[4px]">
              <div className="w-[4px] h-[4px] rounded-full bg-white" />
              <div className="w-[4px] h-[4px] rounded-full bg-white" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-sm">
          <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>criar conta</h1>
          <p className="text-sm text-[#8A8A8A] mb-6">comece a usar o tico gratuitamente</p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider block mb-1.5">nome</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="seu nome"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-[#FAFAF8]"
              />
            </div>
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
                placeholder="minimo 8 caracteres"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-[#FAFAF8]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wider block mb-1.5">confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="repita a senha"
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
              {loading ? 'criando...' : 'criar conta gratis'}
            </button>
          </form>

          <p className="text-center text-sm text-[#8A8A8A] mt-6">
            ja tem conta? <Link href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="text-[#7C3AED] font-medium hover:underline">entrar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function VerifyEmailScreen({ email }: { email: string }) {
  const RESEND_COOLDOWN = 120
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleResend = async () => {
    setResending(true)
    setResent(false)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    setResending(false)

    if (!error) {
      setResent(true)
      setCountdown(RESEND_COOLDOWN)
      setTimeout(() => setResent(false), 4000)
    }
  }

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <div className="flex gap-[4px]">
              <div className="w-[4px] h-[4px] rounded-full bg-white" />
              <div className="w-[4px] h-[4px] rounded-full bg-white" />
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 shadow-sm text-center">
          {/* Email icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            verifique seu e-mail
          </h1>
          <p className="text-sm text-[#8A8A8A] mb-2">
            voce precisa verificar seu e-mail para utilizar o tico.
          </p>
          <p className="text-sm text-[#4A4A4A] mb-6">
            enviamos para: <span className="font-semibold text-[#1A1A1A]">{email}</span>
          </p>

          {resent && (
            <div className="flex items-center justify-center gap-2 text-sm text-[#10B981] bg-[#10B981]/10 px-4 py-2.5 rounded-xl mb-4">
              <span>&#10003;</span> e-mail reenviado com sucesso
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className="w-full py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40 bg-[#F3F2EF] text-[#1A1A1A] hover:bg-gray-200 disabled:hover:bg-[#F3F2EF]"
          >
            {resending
              ? 'reenviando...'
              : countdown > 0
                ? `reenviar e-mail em ${minutes}:${seconds.toString().padStart(2, '0')}`
                : 'reenviar e-mail de verificacao'
            }
          </button>

          <p className="text-xs text-[#8A8A8A] mt-5">
            verifique tambem sua caixa de spam
          </p>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <Link href="/login" className="text-sm text-[#7C3AED] font-medium hover:underline">
              voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
