import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { UpgradePlans } from './UpgradePlans'
import { t, detectLocale, getLocaleFromCookie, type Locale } from '@/lib/i18n'
import { LocaleToggle } from '@/components/LocaleToggle'

export default async function UpgradePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, display_name, tier')
    .eq('id', user.id)
    .single()

  const currentTier = profile?.tier || 'free'

  const cookieStore = await cookies()
  const headerStore = await headers()
  const locale: Locale =
    getLocaleFromCookie(cookieStore.get('locale')?.value) ??
    detectLocale(headerStore.get('accept-language'))

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="border-b border-black/[0.04] bg-white/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2.5">
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
            <a href="/dashboard" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">
              {t('upgrade.back', locale)}
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-14">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            {t('upgrade.title', locale)}
          </h1>
          <p className="text-[#8A8A8A] text-base md:text-lg">
            {t('upgrade.subtitle', locale)}
          </p>
        </div>

        <UpgradePlans currentTier={currentTier} locale={locale} />

        <p className="text-center text-xs text-[#8A8A8A] mt-10">
          {t('upgrade.footer', locale)}
        </p>
      </main>
    </div>
  )
}
