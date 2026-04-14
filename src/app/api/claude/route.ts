import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side Claude API proxy.
 * Reads ANTHROPIC_API_KEY from env — never exposed to browser.
 * Client sends: { messages, systemPrompt, model?, maxTokens?, tools? }
 * Returns: { text, toolUse, stopReason, usage }
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model = 'claude-sonnet-4-6', maxTokens = 1024, tools } = await req.json()

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
    if (tools?.length)  body.tools  = tools

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await r.json()
    if (!r.ok) {
      console.error('[claude proxy]', data)
      return NextResponse.json({ error: data.error?.message ?? 'Claude API error' }, { status: r.status })
    }

    const content   = data.content ?? []
    const text      = content.filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('')
    const toolUse   = content.find((c: { type: string }) => c.type === 'tool_use') ?? null
    const stopReason = data.stop_reason ?? 'end_turn'

    return NextResponse.json({ text, toolUse, stopReason, usage: data.usage })

  } catch (e) {
    console.error('[claude proxy]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
