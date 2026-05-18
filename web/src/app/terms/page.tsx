'use client'

import { useState, useEffect } from 'react'
import { t, type Locale } from '@/lib/i18n'

export default function TermsPage() {
  const [locale, setLocale] = useState<Locale>('pt-br')

  useEffect(() => {
    const cookieLocale = document.cookie.match(/locale=(pt-br|en)/)?.[1] as Locale | undefined
    const detected = cookieLocale ?? (navigator.language.startsWith('pt') ? 'pt-br' : 'en') as Locale
    setLocale(detected)
  }, [])

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <nav className="border-b border-black/[0.04] bg-white/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
                <div className="w-[3px] h-[3px] rounded-full bg-white" />
              </div>
            </div>
            <span className="font-bold text-[15px] tracking-tight" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>tico</span>
          </a>
          <a href="/" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">{t('terms.back', locale)}</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{t('terms.title', locale)}</h1>
        <p className="text-sm text-[#8A8A8A] mb-10">{t('terms.lastUpdated', locale)}</p>

        <div className="space-y-8 text-[15px] text-[#4A4A4A] leading-relaxed">
          {[1, 2, 3, 4].map(i => (
            <section key={i}>
              <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t(`terms.${i}.title`, locale)}</h2>
              <p>{t(`terms.${i}.text`, locale)}</p>
            </section>
          ))}

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('terms.5.title', locale)}</h2>
            <p>{t('terms.5.text', locale)}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {t('terms.5.items', locale).split('|').map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          {[6, 7, 8, 9].map(i => (
            <section key={i}>
              <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t(`terms.${i}.title`, locale)}</h2>
              <p>{t(`terms.${i}.text`, locale)}</p>
            </section>
          ))}

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('terms.10.title', locale)}</h2>
            <p>{t('terms.10.text', locale)} <a href="mailto:support@ticoai.app" className="text-[#7C3AED] hover:underline">support@ticoai.app</a></p>
          </section>
        </div>
      </main>
    </div>
  )
}
