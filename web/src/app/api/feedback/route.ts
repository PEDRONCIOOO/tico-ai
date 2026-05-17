import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { message } = await req.json().catch(() => ({ message: '' }))
  if (!message?.trim()) return NextResponse.json({ error: 'empty message' }, { status: 400 })

  const email = user.email || ''
  const name = user.user_metadata?.display_name || email.split('@')[0]

  // Save to Supabase
  const service = createServiceClient()
  await service.from('feedback').insert({
    user_id: user.id,
    email,
    message: message.trim(),
  })

  // Send email to support via Resend
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
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
              <p style="color:#8A8A8A;font-size:12px;margin:0 0 4px;">de: <strong>${name}</strong> (${email})</p>
              <p style="color:#8A8A8A;font-size:12px;margin:0 0 16px;">user id: ${user.id}</p>
              <div style="background:#F3F2EF;border-radius:12px;padding:16px;">
                <p style="color:#1A1A1A;font-size:14px;line-height:1.6;margin:0;">${message.trim().replace(/\n/g, '<br>')}</p>
              </div>
            </div>
          `,
        }),
      })
    } catch {}
  }

  return NextResponse.json({ status: 'ok' })
}
