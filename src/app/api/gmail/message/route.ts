import { NextRequest, NextResponse } from 'next/server'

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GMAIL_CLIENT_ID     ?? '',
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? '',
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.access_token) return null
  return {
    accessToken: data.access_token,
    expiresAt:   Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

// ── Email body extractor ──────────────────────────────────────────────────────

function decodeBase64Url(data: string): string {
  // Gmail uses base64url encoding (- instead of +, _ instead of /)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

type GmailPayload = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPayload[]
}

function getBody(payload: GmailPayload): string {
  const mimeType = payload.mimeType ?? ''

  // Simple (non-multipart) message
  if (payload.body?.data) {
    const text = decodeBase64Url(payload.body.data)
    return mimeType === 'text/html' ? stripHtml(text) : text
  }

  const parts = payload.parts ?? []

  // Prefer text/plain
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
  }

  // Fallback: text/html (stripped)
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data))
    }
  }

  // Recurse into nested multipart
  for (const part of parts) {
    if ((part.mimeType ?? '').startsWith('multipart/')) {
      const nested = getBody(part)
      if (nested) return nested
    }
  }

  return ''
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/gmail/message
 * Body: { gmailId, accessToken, refreshToken, expiresAt }
 *
 * Fetches the full body of a Gmail message and returns it as plain text.
 */
export async function POST(req: NextRequest) {
  try {
    const { gmailId, accessToken, refreshToken, expiresAt } = await req.json()

    if (!gmailId) {
      return NextResponse.json({ error: 'Missing gmailId' }, { status: 400 })
    }

    let currentToken: string = accessToken ?? ''
    let newAccessToken: string | null = null
    let newExpiresAt: number | null = null

    // Refresh if expired or within 60 seconds of expiry
    if (!currentToken || Date.now() > (Number(expiresAt) - 60_000)) {
      if (!refreshToken) {
        return NextResponse.json({ error: 'Token expired — please reconnect Gmail' }, { status: 401 })
      }
      const refreshed = await refreshAccessToken(String(refreshToken))
      if (!refreshed) {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
      }
      currentToken  = refreshed.accessToken
      newAccessToken = refreshed.accessToken
      newExpiresAt   = refreshed.expiresAt
    }

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=full`,
      { headers: { Authorization: `Bearer ${currentToken}` } }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gmail API error: ${res.status}` },
        { status: res.status }
      )
    }

    const msg = await res.json()
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? []
    const getH = (name: string) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

    // Mark as read — remove UNREAD label (requires gmail.modify scope)
    void fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}/modify`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }
    ) // fire-and-forget, don't await

    return NextResponse.json({
      message: {
        id:             msg.id,
        threadId:       msg.threadId,
        gmailMessageId: getH('Message-ID'),
        from:           getH('From'),
        to:             getH('To'),
        subject:        getH('Subject'),
        date:           getH('Date'),
        body:           getBody(msg.payload ?? {}),
      },
      ...(newAccessToken ? { newAccessToken, newExpiresAt } : {}),
    })

  } catch (e) {
    console.error('[gmail/message]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
