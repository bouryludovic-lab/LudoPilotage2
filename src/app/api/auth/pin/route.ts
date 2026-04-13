import { NextRequest, NextResponse } from 'next/server'
import { AT_BASE, AT_FIELDS, AT_TABLES } from '@/lib/types'

/**
 * Server-side PIN check.
 * Client sends { pin, bootstrapToken }.
 * Returns { ok, token } or { ok: false, error }.
 *
 * When AIRTABLE_TOKEN is set in env, bootstrapToken is ignored
 * and the env token is used for the lookup.
 */
export async function POST(req: NextRequest) {
  try {
    const { pin, bootstrapToken } = await req.json()

    if (!pin || pin.length !== 4) {
      return NextResponse.json({ ok: false, error: 'PIN invalide' }, { status: 400 })
    }

    const token = process.env.AIRTABLE_TOKEN ?? bootstrapToken ?? ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Token non configuré' }, { status: 401 })
    }

    const F = AT_FIELDS.profil
    const url = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLES.profil}?pageSize=100`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Token Airtable invalide' }, { status: 401 })
    }

    const data = await r.json()
    const records: Array<{ id: string; fields: Record<string, unknown> }> = (data.records ?? []).map(
      (rec: { id: string; fields?: Record<string, unknown>; cellValuesByFieldId?: Record<string, unknown> }) => ({
        id: rec.id,
        fields: rec.fields ?? rec.cellValuesByFieldId ?? {},
      })
    )

    for (const rec of records) {
      const storedPin = String(rec.fields[F.pin] ?? '')
      if (storedPin === pin) {
        // If AIRTABLE_TOKEN env is set, return it; otherwise return the per-user token from Airtable
        const workingToken =
          process.env.AIRTABLE_TOKEN ??
          String(rec.fields[F.token] ?? '') ??
          bootstrapToken

        if (!workingToken) {
          return NextResponse.json({ ok: false, error: 'Token de travail non configuré dans Airtable' })
        }

        return NextResponse.json({ ok: true, token: workingToken })
      }
    }

    return NextResponse.json({ ok: false, error: 'PIN incorrect' })
  } catch (e) {
    console.error('[auth/pin]', e)
    return NextResponse.json({ ok: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
