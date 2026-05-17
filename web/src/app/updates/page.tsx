import { getAllPosts } from '@/lib/posts'
import Link from 'next/link'

export default function UpdatesPage() {
  const posts = getAllPosts()

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
          <a href="/" className="text-[13px] text-[#8A8A8A] hover:text-[#1A1A1A] transition">voltar</a>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>atualizacoes</h1>
        <p className="text-sm text-[#8A8A8A] mb-10">novidades e mudancas no tico</p>

        {posts.length === 0 ? (
          <p className="text-[#8A8A8A]">nenhuma atualizacao ainda.</p>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <Link key={post.slug} href={`/updates/${post.slug}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-200/80 p-6 hover:shadow-lg hover:border-[#7C3AED]/20 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                      <div className="flex gap-[2px]">
                        <div className="w-[2px] h-[2px] rounded-full bg-white" />
                        <div className="w-[2px] h-[2px] rounded-full bg-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#1A1A1A]">{post.author}</p>
                      <p className="text-[11px] text-[#8A8A8A]">
                        {new Date(post.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] mb-1" style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {post.title}
                  </h2>
                  <p className="text-sm text-[#8A8A8A]">{post.content.slice(0, 120).trim()}...</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
