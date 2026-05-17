import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/posts'

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts()

  const postEntries = posts.map((post) => ({
    url: `https://ticoai.app/updates/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
  }))

  return [
    { url: 'https://ticoai.app', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1 },
    { url: 'https://ticoai.app/updates', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
    ...postEntries,
    { url: 'https://ticoai.app/privacy', lastModified: new Date(), priority: 0.3 },
    { url: 'https://ticoai.app/terms', lastModified: new Date(), priority: 0.3 },
  ]
}
