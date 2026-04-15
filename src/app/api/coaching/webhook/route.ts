import { NextRequest, NextResponse } from 'next/server'
import { AT_TABLES, AT_FIELDS } from '@/lib/types'

/**
 * Public webhook endpoint for student form submissions.
 * Called by Typeform, Tally, JotForm, Make, Zapier, or any custom form.
 *
 * Configure your form tool to POST to:
 *   https://your-app.vercel.app/api/coaching/webhook?email=coach@email.com
 *
 * Supported formats: Typeform, Tally, generic JSON.
 *
 * Generic JSON fields accepted:
 *   studentName | name | nom
 *   studentEmail | email
 *   question | message | contenu
 *   type  → "offre" | "promesse"  (optional)
 *   pdfUrl | pdfUrls              (optional)
 *   userEmail | coach_email       (or pass ?email= in URL)
 */

const BASE  = process.env.NEXT_PUBLIC_AT_BASE ?? 'appdpkBZRuqEWgOwB'
const TOKEN = process.env.AIRTABLE_TOKEN ?? ''

// ── Form parsers ──────────────────────────────────────────────────────────────

type Parsed = {
  studentName:  string
  studentEmail: string
  question:     string
  questionType: 'offre' | 'promesse' | 'general'
  pdfUrls:      string[]
}

function detectType(raw: string): 'offre' | 'promesse' | 'general' {
  const s = raw.toLowerCase()
  if (s.includes('promesse') || s.includes('résultat') || s.includes('transformation')) return 'promesse'
  if (s.includes('offre') || s.includes('programme') || s.includes('prix') || s.includes('tarif')) return 'offre'
  return 'general'
}

function parseTypeform(body: Record<string, unknown>): Parsed {
  const fr      = body.form_response as Record<string, unknown>
  const defs    = ((fr?.definition as Record<string, unknown>)?.fields as Array<Record<string, unknown>>) ?? []
  const answers = (fr?.answers as Array<Record<string, unknown>>) ?? []

  let studentName = '', studentEmail = '', question = '', raw = ''
  const pdfUrls: string[] = []

  for (const ans of answers) {
    const fieldId = (ans.field as Record<string, unknown>)?.id as string
    const def     = defs.find(d => d.id === fieldId)
    const title   = String(def?.title ?? '').toLowerCase()

    if (typeof ans.email === 'string') studentEmail = ans.email
    if (ans.file_url) pdfUrls.push(String(ans.file_url))

    if (typeof ans.text === 'string') {
      if (!studentName && (title.includes('nom') || title.includes('name') || title.includes('prénom')))
        studentName = ans.text
      else if (!question && (title.includes('quest') || title.includes('message') || title.includes('demand')))
        question = ans.text
      else if (!raw && (title.includes('type') || title.includes('sujet') || title.includes('offre') || title.includes('promesse')))
        raw = ans.text
    }
  }
  // Fallback: first text field = name, second = question
  if (!studentName || !question) {
    const texts = answers.filter(a => typeof a.text === 'string').map(a => a.text as string)
    if (!studentName && texts[0]) studentName = texts[0]
    if (!question    && texts[1]) question     = texts[1]
  }

  return { studentName, studentEmail, question, questionType: detectType(raw || question), pdfUrls }
}

function parseTally(body: Record<string, unknown>): Parsed {
  const data   = body.data as Record<string, unknown>
  const fields = (data?.fields as Array<Record<string, unknown>>) ?? []

  let studentName = '', studentEmail = '', question = '', raw = ''
  const pdfUrls: string[] = []

  for (const field of fields) {
    const label = String(field.label ?? '').toLowerCase()
    const value = field.value

    if (typeof value === 'string') {
      if (label.includes('email'))                                                   studentEmail = value
      else if (label.includes('nom') || label.includes('name') || label.includes('prénom')) studentName = value
      else if (label.includes('quest') || label.includes('message') || label.includes('demand')) question = value
      else if (label.includes('type') || label.includes('offre') || label.includes('promesse')) raw = value
    }
    if (Array.isArray(value)) {
      // file uploads come as array of objects with url
      for (const v of value) {
        if (typeof v === 'object' && v !== null && 'url' in v) pdfUrls.push(String((v as Record<string, unknown>).url))
      }
    }
  }

  return { studentName, studentEmail, question, questionType: detectType(raw || question), pdfUrls }
}

function parseGeneric(body: Record<string, unknown>): Parsed {
  const raw = String(body.type ?? '')
  return {
    studentName:  String(body.studentName  ?? body.name    ?? body.nom     ?? ''),
    studentEmail: String(body.studentEmail ?? body.email   ?? ''),
    question:     String(body.question     ?? body.message ?? body.contenu ?? ''),
    questionType: (['offre', 'promesse'].includes(raw) ? raw : detectType(body.question as string ?? '')) as 'offre' | 'promesse' | 'general',
    pdfUrls:      body.pdfUrl
      ? [String(body.pdfUrl)]
      : Array.isArray(body.pdfUrls)
        ? (body.pdfUrls as unknown[]).map(String)
        : [],
  }
}

function parseBody(body: Record<string, unknown>): Parsed {
  if (body.form_response) return parseTypeform(body)
  if ((body.data as Record<string, unknown>)?.fields) return parseTally(body)
  return parseGeneric(body)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: 'Airtable token not configured' }, { status: 500 })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Coach email: from ?email= URL param, or body field
  const coachEmail =
    req.nextUrl.searchParams.get('email') ||
    String(body.userEmail ?? body.coach_email ?? '')

  const { studentName, studentEmail, question, questionType, pdfUrls } = parseBody(body)

  if (!studentName || !question) {
    return NextResponse.json(
      { error: 'Missing required fields', required: ['studentName (or name/nom)', 'question (or message/contenu)'] },
      { status: 400 }
    )
  }

  // If no coachEmail provided, fetch from first Airtable profil
  let userEmail = coachEmail
  if (!userEmail) {
    try {
      const F   = AT_FIELDS
      const res = await fetch(
        `https://api.airtable.com/v0/${BASE}/${AT_TABLES.profils}?pageSize=1`,
        { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      )
      if (res.ok) {
        const d = await res.json()
        userEmail = String(d.records?.[0]?.fields?.[F.profils.email] ?? '')
      }
    } catch { /* ignore */ }
  }

  const F      = AT_FIELDS
  const today  = new Date().toISOString().split('T')[0]
  const fields = {
    [F.coaching.student_name]:  studentName,
    [F.coaching.student_email]: studentEmail,
    [F.coaching.topic]:         question,
    [F.coaching.date]:          today,
    [F.coaching.status]:        'new',
    [F.coaching.notes]:         JSON.stringify({ type: questionType, pdfUrls }),
    [F.coaching.user_email]:    userEmail,
  }

  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${AT_TABLES.coaching}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ records: [{ fields }] }),
  })
  const data = await r.json()

  if (!r.ok) {
    console.error('[coaching webhook] Airtable error', data)
    return NextResponse.json({ error: 'Failed to save submission', detail: data?.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.records?.[0]?.id, studentName, questionType })
}

// Allow GET for webhook verification (some form tools ping the URL first)
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'LudoPilotage coaching webhook' })
}
