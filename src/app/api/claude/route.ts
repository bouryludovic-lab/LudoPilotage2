import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side Claude API proxy.
 * Reads ANTHROPIC_API_KEY from env — never exposed to browser.
 * Client sends: { messages, systemPrompt, model?, maxTokens? }
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model = 'claude-sonnet-4-6', maxTokens = 1024 } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 401 })
    }

    if (!messages?.length) {
      return NextResponse.json({ error: 'Messages requis' }, { status: 400 })
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages,
    }
    if (systemPrompt) body.system = systemPrompt

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await r.json()
    if (!r.ok) {
      console.error('[claude proxy]', data)
      return NextResponse.json({ error: data.error?.message ?? 'Claude API error' }, { status: r.status })
    }

    const text = data.content?.[0]?.text ?? ''
    return NextResponse.json({ text, usage: data.usage })

  } catch (e) {
    console.error('[claude proxy]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
