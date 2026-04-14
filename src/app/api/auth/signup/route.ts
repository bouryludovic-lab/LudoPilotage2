import { NextRequest, NextResponse } from 'next/server'

/**
 * SaaS signup: creates a new profil record in the new profils table.
 * Client sends { nom, email, pin, siret?, adresse?, tel?, iban?, prefix? }
 * Returns { ok, userEmail, profil } or { ok: false, error }
 */
export async function POST(req: NextRequest) {
  try {
    const { nom, email, pin, siret, adresse, tel, iban, prefix } = await req.json()

    if (!nom || !nom.trim()) {
      return NextResponse.json({ ok: false, error: 'Nom requis' }, { status: 400 })
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Email invalide' }, { status: 400 })
    }
    if (!pin || String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ ok: false, error: 'PIN doit être 4 chiffres' }, { status: 400 })
    }

    const token = process.env.AIRTABLE_TOKEN ?? ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token non configuré' }, { status: 401 })
    }

    const { AT_BASE, AT_TABLES } = await import('@/lib/types')

    // Check if email already exists
    const checkUrl = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLES.profils}?filterByFormula=${encodeURIComponent(`{email}="${email}"`)}&pageSize=1`
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (checkRes.ok) {
      const checkData = await checkRes.json()
      if ((checkData.records ?? []).length > 0) {
        return NextResponse.json({ ok: false, error: 'Un compte existe déjà avec cet email' }, { status: 409 })
      }
    }

    // Create the profil record
    const createUrl = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLES.profils}`
    const fields: Record<string, unknown> = {
      Name:    nom.trim(),
      email:   email.toLowerCase().trim(),
      pin:     String(pin),
      prefix:  prefix || 'F-',
    }
    if (siret)   fields.siret   = siret.trim()
    if (adresse) fields.adresse = adresse.trim()
    if (tel)     fields.tel     = tel.trim()
    if (iban)    fields.iban    = iban.trim()

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }] }),
    })

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}))
      console.error('[auth/signup] Airtable error', errData)
      return NextResponse.json({ ok: false, error: 'Erreur création compte' }, { status: 500 })
    }

    const data = await createRes.json()
    const rec = data.records?.[0]
    if (!rec) {
      return NextResponse.json({ ok: false, error: 'Erreur création compte' }, { status: 500 })
    }

    const profil = {
      atId:    rec.id,
      nom:     String(rec.fields.Name     ?? nom),
      email:   String(rec.fields.email    ?? email),
      siret:   String(rec.fields.siret    ?? ''),
      adresse: String(rec.fields.adresse  ?? ''),
      tel:     String(rec.fields.tel      ?? ''),
      iban:    String(rec.fields.iban     ?? ''),
      prefix:  String(rec.fields.prefix   ?? 'F-'),
    }

    return NextResponse.json({ ok: true, userEmail: profil.email, profil })
  } catch (e) {
    console.error('[auth/signup]', e)
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
