import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

const BASE_USERS = 200

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`stats:${ip}`, 30, 60_000))
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  try {
    const service = createServiceClient()
    const { count } = await service
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json(
      { users: (count ?? 0) + BASE_USERS },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ users: BASE_USERS })
  }
}
