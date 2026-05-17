import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/api/', '/upgrade'],
    },
    sitemap: 'https://ticoai.app/sitemap.xml',
  }
}
