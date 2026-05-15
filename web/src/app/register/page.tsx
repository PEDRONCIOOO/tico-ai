'use client'

import { Suspense, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
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

    router.push(redirect?.startsWith('/') ? redirect : '/dashboard')
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
