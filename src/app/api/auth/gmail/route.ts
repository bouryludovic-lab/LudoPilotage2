import { NextResponse } from 'next/server'

/**
 * GET /api/auth/gmail
 * Redirects the user to Google's OAuth consent screen.
 * The browser navigates here directly (window.location.href) — not a fetch.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID      — from Google Cloud Console (OAuth 2.0 Client ID)
 *   GMAIL_REDIRECT_URI   — e.g. https://your-app.vercel.app/api/auth/gmail/callback
 */
export async function GET() {
  const clientId    = process.env.GMAIL_CLIENT_ID    ?? ''
  const redirectUri = process.env.GMAIL_REDIRECT_URI ?? ''

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'GMAIL_CLIENT_ID or GMAIL_REDIRECT_URI not configured' },
      { status: 500 }
    )
  }

  // A lightweight nonce to mitigate CSRF (no server session available)
  const state = Math.random().toString(36).slice(2, 12)

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/gmail.readonly',
    access_type:   'offline',  // ensures a refresh_token is issued
    prompt:        'consent',  // force consent so refresh_token always comes back
    state,
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  return NextResponse.redirect(authUrl)
}
