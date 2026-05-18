import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

export type Post = {
  slug: string
  title: string
  date: string
  author: string
  content: string
  html: string
}

const postsDir = path.join(process.cwd(), 'content', 'updates')

export function getAllPosts(locale: string = 'pt-br'): Post[] {
  if (!fs.existsSync(postsDir)) return []

  const allFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))

  // Extract unique slugs from filenames like "my-post.pt-br.md"
  const slugs = [...new Set(
    allFiles.map(f => f.replace(/\.(pt-br|en)\.md$/, ''))
  )]

  return slugs
    .map(slug => {
      const localeFile = `${slug}.${locale}.md`
      const fallbackFile = `${slug}.pt-br.md`
      const file = allFiles.includes(localeFile) ? localeFile : fallbackFile
      if (!allFiles.includes(file)) return null

      const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8')
      const { data, content } = matter(raw)
      return {
        slug: data.slug || slug,
        title: data.title || '',
        date: data.date?.toString() || '',
        author: data.author || 'Equipe Tico',
        content,
        html: marked.parse(content) as string,
      }
    })
    .filter((p): p is Post => p !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPost(slug: string, locale: string = 'pt-br'): Post | null {
  const posts = getAllPosts(locale)
  return posts.find(p => p.slug === slug) ?? null
}
