import { NextRequest, NextResponse } from 'next/server'
import type { TriageConfig, MessageCategory, HubPriority } from '@/lib/types'

export const maxDuration = 60

/**
 * POST /api/gmail/triage
 *
 * Body: {
 *   messages: Array<{ id: string; from: string; subject: string; date: string; isImportant?: boolean }>
 *   config:   TriageConfig  (per-user category descriptions)
 * }
 *
 * Calls Claude Haiku to classify each email into a category + priority.
 * Returns: { results: Array<{ id, category, priority }> }
 *
 * Requires env var: ANTHROPIC_API_KEY
 */

interface TriageInput {
  id:          string
  from:        string
  subject:     string
  date?:       string
  isImportant?: boolean
}

interface TriageOutput {
  id:       string
  category: MessageCategory
  priority: HubPriority
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  let messages: TriageInput[] = []
  let config: TriageConfig | null = null

  try {
    const body = await req.json()
    messages = body.messages ?? []
    config   = body.config ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!messages.length) {
    return NextResponse.json({ results: [] })
  }

  // Batch into groups of 10 to keep each Claude call fast (avoid idle timeout)
  const batches: TriageInput[][] = []
  for (let i = 0; i < messages.length; i += 10) {
    batches.push(messages.slice(i, i + 10))
  }

  const systemPrompt = `Tu es un assistant expert en tri d'emails. Classe chaque email dans la bonne catégorie et assigne une priorité.

CATÉGORIES (choisir une seule):
- perso       : ${config?.perso       ?? 'Emails de famille, amis et contacts personnels'}
- pro_admin   : ${config?.pro_admin   ?? 'Administratif pro : factures, contrats, documents légaux, RH'}
- pro_outils  : ${config?.pro_outils  ?? "Notifications d'outils (GitHub, Slack, Vercel, Stripe, Notion, etc.)"}
- pro_promos  : ${config?.pro_promos  ?? "Promotions et offres de services professionnels"}
- pubs        : ${config?.pubs        ?? 'Publicités et emails commerciaux non sollicités'}
- newsletters : ${config?.newsletters ?? 'Newsletters, abonnements, digests, contenus éditoriaux'}
- spam        : ${config?.spam        ?? 'Spam, phishing, emails indésirables ou suspects'}

PRIORITÉS:
- high   : Action immédiate requise (question client directe, urgence business, deadline)
- medium : À traiter dans les prochains jours (demande, suivi, information importante)
- low    : Informatif seulement, pas d'action requise (notifications, confirmations, newsletters)

RÈGLES:
- Les notifications automatiques d'outils sont toujours "low" sauf si elles signalent une erreur critique
- Les newsletters et pubs sont toujours "low"
- Le spam est toujours "low"
- Un email marqué "important" par Gmail mérite au moins "medium"

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication:
[{"id":"...","category":"...","priority":"..."}]`

  const allResults: TriageOutput[] = []

  for (const batch of batches) {
    const userContent = batch
      .map(m => {
        const important = m.isImportant ? ' [IMPORTANT]' : ''
        return `ID: ${m.id}\nDe: ${m.from}\nObjet: ${m.subject}${important}`
      })
      .join('\n---\n')

    try {
      const ctrl  = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 45_000)
      let r: Response
      try {
        r = await fetch('https://api.anthropic.com/v1/messages', {
          method:  'POST',
          signal:  ctrl.signal,
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          body: JSON.stringify({
            model:      'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system:     systemPrompt,
            messages:   [{ role: 'user', content: userContent }],
          }),
        })
      } finally {
        clearTimeout(timer)
      }

      if (!r.ok) {
        console.error('[triage] Claude API error', r.status)
        continue
      }

      const data  = await r.json()
      const text  = data.content?.[0]?.text ?? '[]'
      // Extract the JSON array (Claude may wrap it in markdown)
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) continue

      const parsed: TriageOutput[] = JSON.parse(match[0])
      allResults.push(...parsed)
    } catch (e) {
      console.error('[triage] batch error', e)
    }
  }

  return NextResponse.json({ results: allResults })
}
