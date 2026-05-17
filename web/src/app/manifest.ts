import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tico — seu buddy de IA no Windows',
    short_name: 'Tico',
    description: 'Assistente de IA para Windows que fica ao lado do seu cursor e vê tudo na sua tela.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF8',
    theme_color: '#7C3AED',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
