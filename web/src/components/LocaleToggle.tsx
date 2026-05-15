'use client'

import { type Locale } from '@/lib/i18n'

export function LocaleToggle({ locale }: { locale: Locale }) {
  const switchTo = (next: Locale) => {
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-1 text-[12px] tracking-wide">
      <button
        onClick={() => switchTo('pt-br')}
        className={`transition ${locale === 'pt-br' ? 'text-[#1A1A1A] font-semibold' : 'text-[#8A8A8A] hover:text-[#1A1A1A]'}`}
      >
        PT
      </button>
      <span className="text-[#D1D1D1]">/</span>
      <button
        onClick={() => switchTo('en')}
        className={`transition ${locale === 'en' ? 'text-[#1A1A1A] font-semibold' : 'text-[#8A8A8A] hover:text-[#1A1A1A]'}`}
      >
        EN
      </button>
    </div>
  )
}
