import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const BASE_USERS = 50

export async function GET() {
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
