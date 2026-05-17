'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Comment = {
  id: string
  display_name: string
  content: string
  created_at: string
}

export default function PostInteractions({ slug }: { slug: string }) {
  const [likes, setLikes] = useState(0)
  const [userLiked, setUserLiked] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    loadData()
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      const res = await fetch(`/api/posts?slug=${slug}`)
      const data = await res.json()
      setLikes(data.likes ?? 0)
      setUserLiked(data.userLiked ?? false)
      setComments(data.comments ?? [])
    } catch {}
  }

  const handleLike = async () => {
    if (!isAuthed) return
    const action = userLiked ? 'unlike' : 'like'
    setUserLiked(!userLiked)
    setLikes(l => l + (userLiked ? -1 : 1))
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, action }),
    })
  }

  const handleComment = async () => {
    if (!newComment.trim() || sending || !isAuthed) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        action: 'comment',
        content: newComment,
        displayName: user?.user_metadata?.display_name || user?.email?.split('@')[0],
      }),
    })
    setNewComment('')
    setSending(false)
    await loadData()
  }

  return (
    <div className="border-t border-gray-200/80 pt-8">
      {/* Like button */}
      <button
        onClick={handleLike}
        disabled={!isAuthed}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
          userLiked
            ? 'bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30'
            : 'bg-[#F3F2EF] text-[#4A4A4A] hover:bg-gray-200 border border-transparent'
        } ${!isAuthed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <svg className="w-4 h-4" fill={userLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {likes > 0 && <span>{likes}</span>}
      </button>

      {/* Comments section */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-[#8A8A8A] uppercase tracking-widest mb-4">
          comentarios ({comments.length})
        </h3>

        {comments.length > 0 && (
          <div className="space-y-4 mb-6">
            {comments.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200/80 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">{(c.display_name || '?')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium text-[#1A1A1A]">{c.display_name}</span>
                  <span className="text-[11px] text-[#8A8A8A]">
                    {new Date(c.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="text-sm text-[#4A4A4A] leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        )}

        {isAuthed ? (
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="escreva um comentario..."
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 transition bg-white"
            />
            <button
              onClick={handleComment}
              disabled={!newComment.trim() || sending}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#1A1A1A] text-white hover:bg-gray-800 transition disabled:opacity-40"
            >
              {sending ? '...' : 'enviar'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[#8A8A8A]">
            <a href="/login" className="text-[#7C3AED] hover:underline">entre na sua conta</a> para curtir e comentar.
          </p>
        )}
      </div>
    </div>
  )
}
