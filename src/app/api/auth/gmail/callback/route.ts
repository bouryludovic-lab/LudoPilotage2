import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/gmail/callback
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for access + refresh tokens, then
 * redirects back to /configuration with tokens in the URL so the client
 * can store them in localStorage.
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   GMAIL_REDIRECT_URI
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  // User denied access on Google consent screen
  if (error) {
    return NextResponse.redirect(
      new URL('/configuration?gmail_error=access_denied', req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/configuration?gmail_error=missing_code', req.url)
    )
  }

  const clientId     = process.env.GMAIL_CLIENT_ID     ?? ''
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? ''
  const redirectUri  = process.env.GMAIL_REDIRECT_URI  ?? ''

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL('/configuration?gmail_error=server_config', req.url)
    )
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[gmail/callback] Token exchange failed', tokenData)
      return NextResponse.redirect(
        new URL('/configuration?gmail_error=token_exchange', req.url)
      )
    }

    const expiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000

    // Pass tokens via redirect URL params — client stores in localStorage.
    // Note: tokens are briefly visible in browser history; this matches the
    // app's existing localStorage-first security posture.
    const successParams = new URLSearchParams({
      gmail_success: '1',
      at:  tokenData.access_token,
      rt:  tokenData.refresh_token ?? '',
      exp: String(expiresAt),
    })

    return NextResponse.redirect(
      new URL(`/configuration?${successParams}`, req.url)
    )
  } catch (e) {
    console.error('[gmail/callback] Unexpected error', e)
    return NextResponse.redirect(
      new URL('/configuration?gmail_error=server_error', req.url)
    )
  }
}
