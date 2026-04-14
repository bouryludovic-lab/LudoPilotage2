import { NextRequest, NextResponse } from 'next/server'

/**
 * PIN login against the profils table (field names).
 * Client sends { pin }.
 * Returns { ok, userEmail, profil } or { ok: false, error }.
 */
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()

    if (!pin || String(pin).length !== 4) {
      return NextResponse.json({ ok: false, error: 'PIN invalide' }, { status: 400 })
    }

    const token = process.env.AIRTABLE_TOKEN ?? ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token non configuré' }, { status: 401 })
    }

    const { AT_BASE, AT_TABLES, AT_FIELDS } = await import('@/lib/types')
    const F = AT_FIELDS.profils

    // Filter directly by PIN — much faster than fetching all records
    const url = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLES.profils}` +
      `?filterByFormula=${encodeURIComponent(`{${F.pin}}="${pin}"`)}&pageSize=5`

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Connexion Airtable échouée' }, { status: 401 })
    }

    const data = await r.json()
    const records: Array<{ id: string; fields: Record<string, unknown> }> = data.records ?? []

    if (records.length === 0) {
      return NextResponse.json({ ok: false, error: 'PIN incorrect' })
    }

    const rec = records[0]
    const f   = rec.fields
    const userEmail = String(f[F.email] ?? '')
    const profil = {
      atId:    rec.id,
      nom:     String(f[F.nom]     ?? ''),
      email:   userEmail,
      siret:   String(f[F.siret]   ?? ''),
      adresse: String(f[F.adresse] ?? ''),
      tel:     String(f[F.tel]     ?? ''),
      iban:    String(f[F.iban]    ?? ''),
      prefix:  String(f[F.prefix]  ?? 'F-'),
      webhook: f[F.webhook]  ? String(f[F.webhook])  : undefined,
      ghToken: f[F.gh_token] ? String(f[F.gh_token]) : undefined,
    }

    return NextResponse.json({ ok: true, userEmail, profil })
  } catch (e) {
    console.error('[auth/pin]', e)
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
