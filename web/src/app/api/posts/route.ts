import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'

// GET /api/posts?slug=xxx — get like count + comments + user's like status
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 })

  const service = createServiceClient()

  const [{ count: likeCount }, { data: comments }] = await Promise.all([
    service.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_slug', slug),
    service.from('post_comments').select('id, display_name, content, created_at').eq('post_slug', slug).order('created_at', { ascending: true }).limit(100),
  ])

  // Check if current user liked
  let userLiked = false
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await service.from('post_likes').select('id').eq('post_slug', slug).eq('user_id', user.id).single()
      userLiked = !!data
    }
  } catch {}

  return NextResponse.json({ likes: likeCount ?? 0, userLiked, comments: comments ?? [] })
}

// POST /api/posts — like/unlike or comment
export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { slug, action, content, displayName } = body

  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 })

  const service = createServiceClient()

  if (action === 'like') {
    await service.from('post_likes').insert({ post_slug: slug, user_id: user.id })
    return NextResponse.json({ status: 'liked' })
  }

  if (action === 'unlike') {
    await service.from('post_likes').delete().eq('post_slug', slug).eq('user_id', user.id)
    return NextResponse.json({ status: 'unliked' })
  }

  if (action === 'comment') {
    if (!content?.trim()) return NextResponse.json({ error: 'empty comment' }, { status: 400 })
    await service.from('post_comments').insert({
      post_slug: slug,
      user_id: user.id,
      display_name: displayName || user.email?.split('@')[0] || 'anon',
      content: content.trim(),
    })
    return NextResponse.json({ status: 'commented' })
  }

  return NextResponse.json({ error: 'invalid action' }, { status: 400 })
}
