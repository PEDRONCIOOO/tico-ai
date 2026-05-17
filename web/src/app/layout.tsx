import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://ticoai.app'),
  title: 'Tico — seu buddy de IA no Windows',
  description: 'Ele fica do lado do seu cursor e vê tudo na sua tela. Aperte um atalho, faça uma pergunta em voz alta, e ele te guia pelo que você estiver fazendo.',
  keywords: ['IA', 'assistente', 'Windows', 'cursor', 'buddy', 'inteligência artificial', 'produtividade'],
  openGraph: {
    title: 'Tico — seu buddy de IA no Windows',
    description: 'Ele fica do lado do seu cursor e vê tudo na sua tela. Como um amigo que é muito bom em tudo.',
    type: 'website',
    locale: 'pt_BR',
    url: 'https://ticoai.app',
    siteName: 'Tico',
    images: [
      {
        url: 'https://dl.ticoai.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Tico — seu amigo IA que te acompanha',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tico — seu buddy de IA no Windows',
    description: 'Ele fica do lado do seu cursor e vê tudo na sua tela. Como um amigo que é muito bom em tudo.',
    images: ['https://dl.ticoai.app/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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
              description: 'Assistente de IA para Windows que fica ao lado do seu cursor e vê tudo na sua tela.',
              url: 'https://ticoai.app',
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: 'Windows',
              offers: [
                { '@type': 'Offer', price: '0', priceCurrency: 'BRL', name: 'Gratis' },
                { '@type': 'Offer', price: '45', priceCurrency: 'BRL', name: 'Pro' },
                { '@type': 'Offer', price: '99.90', priceCurrency: 'BRL', name: 'Ilimitado' },
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
