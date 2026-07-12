import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://ticoai.app'),
  title: 'Tico — your AI buddy on Windows',
  description: 'Tico stays next to your cursor and sees everything on your screen. Press a hotkey, ask a question out loud, and it guides you through whatever you are doing.',
  keywords: ['AI', 'assistant', 'Windows', 'cursor', 'buddy', 'artificial intelligence', 'productivity'],
  openGraph: {
    title: 'Tico — your AI buddy on Windows',
    description: 'Tico stays next to your cursor and sees everything on your screen. Like a friend who knows everything.',
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'pt_BR',
    url: 'https://ticoai.app',
    siteName: 'Tico',
    images: [
      {
        url: 'https://dl.ticoai.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tico — your AI buddy that guides you',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tico — your AI buddy on Windows',
    description: 'Tico stays next to your cursor and sees everything on your screen. Like a friend who knows everything.',
    images: ['https://dl.ticoai.app/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Tico',
              description: 'AI assistant for Windows that stays next to your cursor and sees everything on your screen.',
              url: 'https://ticoai.app',
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Windows',
              offers: [
                { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
                { '@type': 'Offer', price: '9.99', priceCurrency: 'USD', name: 'Pro' },
                { '@type': 'Offer', price: '19.99', priceCurrency: 'USD', name: 'Unlimited' },
              ],
              image: 'https://dl.ticoai.app/og-image.png',
            }),
          }}
        />
      </head>
      <body>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-11HMTJDK5N"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-11HMTJDK5N');
          `}
        </Script>
        {children}
      </body>
    </html>
  )
}
