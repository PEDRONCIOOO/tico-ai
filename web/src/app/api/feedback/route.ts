import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { message } = await req.json().catch(() => ({ message: '' }))
  if (!message?.trim()) return NextResponse.json({ error: 'empty message' }, { status: 400 })
  if (message.length > 10000) return NextResponse.json({ error: 'message too long' }, { status: 400 })

  // Rate limit: 2 feedbacks per hour per user
  if (!rateLimit(`feedback:${user.id}`, 2, 60 * 60 * 1000))
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  const email = user.email || ''

  // Derive name server-side from profile, not user_metadata (which is user-editable)
  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name || email.split('@')[0]

  // Save to Supabase
  await service.from('feedback').insert({
    user_id: user.id,
    email,
    message: message.trim(),
  })

  // Send email to support via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    // Sanitize to prevent HTML injection in email
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Tico Feedback <support@ticoai.app>',
          to: 'support@ticoai.app',
          subject: `feedback de ${name} (${email})`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;">
              <p style="color:#8A8A8A;font-size:12px;margin:0 0 4px;">de: <strong>${esc(name)}</strong> (${esc(email)})</p>
              <p style="color:#8A8A8A;font-size:12px;margin:0 0 16px;">user id: ${user.id}</p>
              <div style="background:#F3F2EF;border-radius:12px;padding:16px;">
                <p style="color:#1A1A1A;font-size:14px;line-height:1.6;margin:0;">${esc(message.trim()).replace(/\n/g, '<br>')}</p>
              </div>
            </div>
          `,
        }),
      })
    } catch {}
  }

  return NextResponse.json({ status: 'ok' })
}
