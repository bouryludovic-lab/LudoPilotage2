import { NextRequest, NextResponse } from 'next/server'

/**
 * PIN login against new profils table.
 * Client sends { pin }.
 * Returns { ok, userEmail, profil } or { ok: false, error }.
 */
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json()

    if (!pin || pin.length !== 4) {
      return NextResponse.json({ ok: false, error: 'PIN invalide' }, { status: 400 })
    }

    const token = process.env.AIRTABLE_TOKEN ?? ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token non configuré' }, { status: 401 })
    }

    // Fetch all profils, find matching PIN
    const { AT_BASE, AT_TABLES, AT_FIELDS } = await import('@/lib/types')
    // returnFieldsByFieldId=true because old table uses field IDs
    const url = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLES.profils}?pageSize=100&returnFieldsByFieldId=true`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Connexion Airtable échouée' }, { status: 401 })
    }

    const data = await r.json()
    const records: Array<{ id: string; fields: Record<string, unknown> }> = data.records ?? []

    for (const rec of records) {
      const storedPin = String(rec.fields[AT_FIELDS.profils.pin] ?? '')
      if (storedPin === pin) {
        const userEmail = String(rec.fields[AT_FIELDS.profils.email] ?? '')
        const profil = {
          atId:    rec.id,
          nom:     String(rec.fields[AT_FIELDS.profils.nom]     ?? ''),
          email:   userEmail,
          siret:   String(rec.fields[AT_FIELDS.profils.siret]   ?? ''),
          adresse: String(rec.fields[AT_FIELDS.profils.adresse] ?? ''),
          tel:     String(rec.fields[AT_FIELDS.profils.tel]     ?? ''),
          iban:    String(rec.fields[AT_FIELDS.profils.iban]    ?? ''),
          prefix:  String(rec.fields[AT_FIELDS.profils.prefix]  ?? 'F-'),
        }
        return NextResponse.json({ ok: true, userEmail, profil })
      }
    }

    return NextResponse.json({ ok: false, error: 'PIN incorrect' })
  } catch (e) {
    console.error('[auth/pin]', e)
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
