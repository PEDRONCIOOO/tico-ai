'use client'

import { useState, useEffect } from 'react'
import { t, type Locale } from '@/lib/i18n'

export default function PrivacyPage() {
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
          <a href="/" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">{t('privacy.back', locale)}</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{t('privacy.title', locale)}</h1>
        <p className="text-sm text-[#8A8A8A] mb-10">{t('privacy.lastUpdated', locale)}</p>

        <div className="space-y-8 text-[15px] text-[#4A4A4A] leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.1.title', locale)}</h2>
            <p>{t('privacy.1.text', locale)}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {t('privacy.1.items', locale).split('|').map((item, i) => {
                const [bold, ...rest] = item.split(':')
                return rest.length > 0
                  ? <li key={i}><strong>{bold}:</strong>{rest.join(':')}</li>
                  : <li key={i}>{item}</li>
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.2.title', locale)}</h2>
            <p>{t('privacy.2.text', locale)}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {t('privacy.2.items', locale).split('|').map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="mt-2">{t('privacy.2.extra', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.3.title', locale)}</h2>
            <ul className="list-disc pl-6 space-y-1">
              {t('privacy.3.items', locale).split('|').map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.4.title', locale)}</h2>
            <p>{t('privacy.4.text', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.5.title', locale)}</h2>
            <p>{t('privacy.5.text', locale)}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {t('privacy.5.items', locale).split('|').map((item, i) => {
                const [bold, ...rest] = item.split(':')
                return rest.length > 0
                  ? <li key={i}><strong>{bold}:</strong>{rest.join(':')}</li>
                  : <li key={i}>{item}</li>
              })}
            </ul>
            <p className="mt-2">{t('privacy.5.extra', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.6.title', locale)}</h2>
            <p>{t('privacy.6.text', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.7.title', locale)}</h2>
            <p>{t('privacy.7.text', locale)}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              {t('privacy.7.items', locale).split('|').map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className="mt-2">{t('privacy.7.extra', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.8.title', locale)}</h2>
            <p>{t('privacy.8.text', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.9.title', locale)}</h2>
            <p>{t('privacy.9.text', locale)}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-3">{t('privacy.10.title', locale)}</h2>
            <p>{t('privacy.10.text', locale)} <a href="mailto:support@ticoai.app" className="text-[#7C3AED] hover:underline">support@ticoai.app</a></p>
          </section>
        </div>
      </main>
    </div>
  )
}
