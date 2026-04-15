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

// ── RFC 2822 / MIME builder ───────────────────────────────────────────────────

interface Attachment {
  name:   string
  type:   string   // MIME type, e.g. "application/pdf"
  base64: string   // raw base64 (no data URI prefix)
}

function buildRawEmail(params: {
  to: string
  subject: string
  body: string
  inReplyTo?:  string
  references?: string
  attachments?: Attachment[]
}): string {
  const { to, subject, body, inReplyTo, references, attachments = [] } = params

  // ── Simple text email (no attachments) ─────────────────────────────────────
  if (attachments.length === 0) {
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
    ]
    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`)
      lines.push(`References: ${references || inReplyTo}`)
    }
    lines.push('')
    lines.push(body)
    return lines.join('\r\n')
  }

  // ── Multipart/mixed email (with attachments) ──────────────────────────────
  const boundary = `----=_NextPart_${Date.now().toString(36)}`

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ]
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
    headers.push(`References: ${references || inReplyTo}`)
  }

  const parts: string[] = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ]

  for (const att of attachments) {
    const safeName = att.name.replace(/"/g, '')
    const safeType = att.type || 'application/octet-stream'
    // RFC 2045: base64 lines must be ≤76 chars
    const b64Lines = (att.base64.match(/.{1,76}/g) ?? []).join('\r\n')
    parts.push(
      `--${boundary}`,
      `Content-Type: ${safeType}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      '',
      b64Lines,
    )
  }

  parts.push(`--${boundary}--`)
  return parts.join('\r\n')
}

function encodeBase64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/gmail/send
 *
 * Body: {
 *   to, subject, body,
 *   threadId?,    — include to reply in thread
 *   inReplyTo?,   — Message-ID header value of original email
 *   references?,  — same as inReplyTo for simple replies
 *   accessToken, refreshToken, expiresAt
 * }
 *
 * Sends a new email or a reply via Gmail API.
 * Requires gmail.modify or gmail.send scope.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      to, subject, body,
      threadId, inReplyTo, references,
      attachments,
      accessToken, refreshToken, expiresAt,
    } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
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

    const raw = encodeBase64Url(buildRawEmail({ to, subject, body, inReplyTo, references, attachments }))

    const payload: Record<string, unknown> = { raw }
    if (threadId) payload.threadId = threadId

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[gmail/send] error', data)
      return NextResponse.json(
        { error: data.error?.message ?? 'Failed to send email' },
        { status: res.status }
      )
    }

    return NextResponse.json({
      ok:  true,
      id:  data.id,
      ...(newAccessToken ? { newAccessToken, newExpiresAt } : {}),
    })

  } catch (e) {
    console.error('[gmail/send]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
