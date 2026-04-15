import { NextRequest, NextResponse } from 'next/server'
import type { HubMessage, HubPriority } from '@/lib/types'

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

// ── Gmail header parser ───────────────────────────────────────────────────────

function parseFromHeader(from: string): string {
  // "John Doe <john@example.com>" → "John Doe"
  // "<john@example.com>"          → "john@example.com"
  // "john@example.com"            → "john@example.com"
  const match = from.match(/^"?([^"<]+)"?\s*</)
  if (match) return match[1].trim()
  return from.replace(/<[^>]+>/, '').trim() || from
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/gmail/sync
 *
 * Body: { accessToken, refreshToken, expiresAt, userEmail }
 *
 * Fetches the 20 most recent unread Gmail messages and returns them
 * as HubMessage[]. Transparently refreshes the access token if expired.
 *
 * Response: {
 *   messages: HubMessage[]
 *   newAccessToken?: string   // only present when a refresh occurred
 *   newExpiresAt?:  number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, refreshToken, expiresAt, userEmail } = await req.json()

    if (!accessToken && !refreshToken) {
      return NextResponse.json({ error: 'No Gmail tokens provided' }, { status: 401 })
    }

    let currentAccessToken: string = accessToken ?? ''
    let newExpiresAt: number | null  = null
    let newAccessToken: string | null = null

    // Refresh if expired or within 60 seconds of expiry
    if (!currentAccessToken || Date.now() > ((expiresAt as number) - 60_000)) {
      if (!refreshToken) {
        return NextResponse.json(
          { error: 'Token expired and no refresh token — please reconnect Gmail' },
          { status: 401 }
        )
      }
      const refreshed = await refreshAccessToken(String(refreshToken))
      if (!refreshed) {
        return NextResponse.json(
          { error: 'Token refresh failed — please reconnect Gmail in Configuration' },
          { status: 401 }
        )
      }
      currentAccessToken = refreshed.accessToken
      newExpiresAt       = refreshed.expiresAt
      newAccessToken     = refreshed.accessToken
    }

    const authHeader = { Authorization: `Bearer ${currentAccessToken}` }

    // ── Fetch message list ────────────────────────────────────────────────────
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=is:unread',
      { headers: authHeader }
    )

    if (!listRes.ok) {
      if (listRes.status === 401) {
        return NextResponse.json(
          { error: 'Gmail token invalid — please reconnect Gmail in Configuration' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: `Gmail API error: ${listRes.status}` },
        { status: listRes.status }
      )
    }

    const listData = await listRes.json()
    const messageIds: string[] = (listData.messages ?? []).map(
      (m: { id: string }) => m.id
    )

    if (messageIds.length === 0) {
      return NextResponse.json({
        messages: [],
        ...(newAccessToken ? { newAccessToken, newExpiresAt } : {}),
      })
    }

    // ── Fetch message details in parallel ─────────────────────────────────────
    const detailPromises = messageIds.slice(0, 20).map(id =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
        `?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: authHeader }
      ).then(r => (r.ok ? r.json() : null))
    )

    const details = await Promise.all(detailPromises)

    // ── Transform to HubMessage[] ─────────────────────────────────────────────
    const messages: HubMessage[] = details
      .filter(Boolean)
      .map((msg) => {
        const headers: Array<{ name: string; value: string }> = msg.payload?.headers ?? []
        const getHeader = (name: string) =>
          headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

        const from    = getHeader('From')
        const subject = getHeader('Subject')
        const date    = getHeader('Date')

        // Parse RFC 2822 date from Gmail header
        let isoDate = new Date().toISOString().split('T')[0]
        try {
          const parsed = new Date(date)
          if (!isNaN(parsed.getTime())) isoDate = parsed.toISOString().split('T')[0]
        } catch { /* keep today */ }

        const labelIds: string[] = msg.labelIds ?? []
        const isUnread    = labelIds.includes('UNREAD')
        const isImportant = labelIds.includes('IMPORTANT')

        const priority: HubPriority = isImportant ? 'high' : 'medium'

        return {
          id:             `gmail_${msg.id}`,
          source:         'email' as const,
          author:         parseFromHeader(from),
          content:        subject || '(sans objet)',
          date:           isoDate,
          priority,
          read:           !isUnread,
          tags:           ['gmail'],
          actionRequired: false,
          userEmail:      String(userEmail ?? ''),
        }
      })

    return NextResponse.json({
      messages,
      ...(newAccessToken ? { newAccessToken, newExpiresAt } : {}),
    })

  } catch (e) {
    console.error('[gmail/sync]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
