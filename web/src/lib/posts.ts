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

export function getAllPosts(): Post[] {
  if (!fs.existsSync(postsDir)) return []

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'))

  return files
    .map(file => {
      const raw = fs.readFileSync(path.join(postsDir, file), 'utf-8')
      const { data, content } = matter(raw)
      return {
        slug: data.slug || file.replace('.md', ''),
        title: data.title || '',
        date: data.date?.toString() || '',
        author: data.author || 'Equipe Tico',
        content,
        html: marked.parse(content) as string,
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPost(slug: string): Post | null {
  const posts = getAllPosts()
  return posts.find(p => p.slug === slug) ?? null
}
