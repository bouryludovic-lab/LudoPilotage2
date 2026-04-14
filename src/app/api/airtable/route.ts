import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side Airtable proxy.
 * The client sends: { table, method, id?, fields?, query? }
 * This route uses AIRTABLE_TOKEN from env — never exposed to the browser.
 *
 * If AIRTABLE_TOKEN is not set, falls back to the token sent in
 * X-AT-Token header (for backward-compat while user sets up Vercel env).
 */

const BASE = process.env.NEXT_PUBLIC_AT_BASE ?? 'appdpkBZRuqEWgOwB'

function atUrl(table: string, id?: string, query?: string) {
  const base = `https://api.airtable.com/v0/${BASE}/${table}${id ? '/' + id : ''}`
  return query ? `${base}?${query}` : base
}

function atHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table, method = 'GET', id, fields, query } = body

    if (!table) return NextResponse.json({ error: 'Missing table' }, { status: 400 })

    // Prefer server-side env token, fall back to client-provided header
    const token =
      process.env.AIRTABLE_TOKEN ??
      req.headers.get('x-at-token') ??
      ''

    if (!token) {
      return NextResponse.json({ error: 'No Airtable token configured' }, { status: 401 })
    }

    // ── GET all ──────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const records: unknown[] = []
      let offset: string | null = null
      do {
        const qs: string = 'pageSize=100&returnFieldsByFieldId=true' + (offset ? '&offset=' + offset : '') + (query ? '&' + query : '')
        const r = await fetch(atUrl(table, undefined, qs), { headers: atHeaders(token) })
        if (!r.ok) return NextResponse.json({ error: `Airtable ${r.status}` }, { status: r.status })
        const d = await r.json()
        records.push(...(d.records ?? []))
        offset = d.offset ?? null
      } while (offset)
      return NextResponse.json({ records })
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (method === 'POST') {
      const r = await fetch(atUrl(table), {
        method: 'POST',
        headers: atHeaders(token),
        body: JSON.stringify({ records: [{ fields }] }),
      })
      const d = await r.json()
      if (!r.ok) return NextResponse.json({ error: d.error ?? 'Create failed' }, { status: r.status })
      return NextResponse.json(d)
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (method === 'PATCH') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const r = await fetch(atUrl(table, id), {
        method: 'PATCH',
        headers: atHeaders(token),
        body: JSON.stringify({ fields }),
      })
      const d = await r.json()
      if (!r.ok) return NextResponse.json({ error: d.error ?? 'Update failed' }, { status: r.status })
      return NextResponse.json(d)
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
      const r = await fetch(atUrl(table, id), {
        method: 'DELETE',
        headers: atHeaders(token),
      })
      if (!r.ok) return NextResponse.json({ error: 'Delete failed' }, { status: r.status })
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Unknown method' }, { status: 400 })

  } catch (e) {
    console.error('[airtable proxy]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
