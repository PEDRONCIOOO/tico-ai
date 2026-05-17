import { getAllPosts, getPost } from '@/lib/posts'
import { notFound } from 'next/navigation'
import PostInteractions from './PostInteractions'

export function generateStaticParams() {
  return getAllPosts().map(p => ({ slug: p.slug }))
}

export default async function UpdatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

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
          <a href="/updates" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">todas atualizacoes</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        {/* Post header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
            <div className="flex gap-[3px]">
              <div className="w-[3px] h-[3px] rounded-full bg-white" />
              <div className="w-[3px] h-[3px] rounded-full bg-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A]">{post.author}</p>
            <p className="text-xs text-[#8A8A8A]">
              {new Date(post.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-8" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
          {post.title}
        </h1>

        {/* Post content */}
        <div
          className="prose prose-sm max-w-none text-[#4A4A4A] mb-12
            [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#1A1A1A] [&_h2]:mt-8 [&_h2]:mb-3
            [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#1A1A1A] [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:mb-4
            [&_li]:text-[15px]
            [&_a]:text-[#7C3AED] [&_a]:hover:underline
            [&_strong]:text-[#1A1A1A]
            [&_code]:bg-[#F3F2EF] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* Likes + Comments */}
        <PostInteractions slug={post.slug} />
      </main>
    </div>
  )
}
