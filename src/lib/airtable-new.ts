/**
 * Server-side Airtable client for new multi-user tables.
 * Uses field names (not IDs). Call from API routes only.
 */

import { AT_BASE, AT_TABLES, AT_FIELDS, type Invoice, type Client, type Profil, type HubMessage, type CoachingSession } from './types'

const F = AT_FIELDS

// ─── Core helpers ─────────────────────────────────────────────────────────────

function url(table: string, id = '') {
  return `https://api.airtable.com/v0/${AT_BASE}/${table}${id ? '/' + id : ''}`
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

type ATRecord = { id: string; fields: Record<string, unknown> }

async function getAll(table: string, token: string, filterFormula?: string): Promise<ATRecord[]> {
  const records: ATRecord[] = []
  let offset: string | null = null
  do {
    let qs = 'pageSize=100'
    if (offset) qs += `&offset=${offset}`
    if (filterFormula) qs += `&filterByFormula=${encodeURIComponent(filterFormula)}`
    const r = await fetch(`${url(table)}?${qs}`, { headers: headers(token) })
    if (!r.ok) throw new Error(`Airtable GET ${r.status}`)
    const d = await r.json()
    records.push(...(d.records ?? []))
    offset = d.offset ?? null
  } while (offset)
  return records
}

async function create(table: string, token: string, fields: Record<string, unknown>): Promise<ATRecord | null> {
  const r = await fetch(url(table), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ records: [{ fields }] }),
  })
  if (!r.ok) throw new Error(`Airtable POST ${r.status}`)
  const d = await r.json()
  return d.records?.[0] ?? null
}

async function patch(table: string, id: string, token: string, fields: Record<string, unknown>): Promise<ATRecord | null> {
  const r = await fetch(url(table, id), {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Airtable PATCH ${r.status}`)
  return await r.json()
}

async function del(table: string, id: string, token: string): Promise<void> {
  const r = await fetch(url(table, id), { method: 'DELETE', headers: headers(token) })
  if (!r.ok) throw new Error(`Airtable DELETE ${r.status}`)
}

// ─── Profil ───────────────────────────────────────────────────────────────────

export async function getProfil(token: string, email?: string): Promise<Profil | null> {
  const filter = email ? `{${F.profils.email}}="${email}"` : undefined
  const records = await getAll(AT_TABLES.profils, token, filter)
  if (!records.length) return null
  const rec = records[0]
  const f = rec.fields
  return {
    atId:      rec.id,
    nom:       String(f[F.profils.nom]        ?? ''),
    email:     String(f[F.profils.email]      ?? ''),
    siret:     String(f[F.profils.siret]      ?? ''),
    adresse:   String(f[F.profils.adresse]    ?? ''),
    tel:       String(f[F.profils.tel]        ?? ''),
    iban:      String(f[F.profils.iban]       ?? ''),
    prefix:    String(f[F.profils.prefix]     ?? 'F-'),
    pin:       String(f[F.profils.pin]        ?? ''),
    webhook:   f[F.profils.webhook]    ? String(f[F.profils.webhook])    : undefined,
    ghToken:   f[F.profils.gh_token]   ? String(f[F.profils.gh_token])   : undefined,
    claudeKey: f[F.profils.claude_key] ? String(f[F.profils.claude_key]) : undefined,
  }
}

export async function createProfil(token: string, profil: Profil): Promise<string | null> {
  const rec = await create(AT_TABLES.profils, token, {
    [F.profils.nom]:     profil.nom,
    [F.profils.email]:   profil.email,
    [F.profils.siret]:   profil.siret   ?? '',
    [F.profils.adresse]: profil.adresse ?? '',
    [F.profils.tel]:     profil.tel     ?? '',
    [F.profils.iban]:    profil.iban    ?? '',
    [F.profils.prefix]:  profil.prefix  ?? 'F-',
    [F.profils.pin]:     profil.pin     ?? '',
  })
  return rec?.id ?? null
}

export async function updateProfil(token: string, atId: string, profil: Partial<Profil>): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (profil.nom       !== undefined) fields[F.profils.nom]        = profil.nom
  if (profil.siret     !== undefined) fields[F.profils.siret]      = profil.siret
  if (profil.adresse   !== undefined) fields[F.profils.adresse]    = profil.adresse
  if (profil.email     !== undefined) fields[F.profils.email]      = profil.email
  if (profil.tel       !== undefined) fields[F.profils.tel]        = profil.tel
  if (profil.iban      !== undefined) fields[F.profils.iban]       = profil.iban
  if (profil.prefix    !== undefined) fields[F.profils.prefix]     = profil.prefix
  if (profil.pin       !== undefined) fields[F.profils.pin]        = profil.pin
  if (profil.webhook   !== undefined) fields[F.profils.webhook]    = profil.webhook
  if (profil.ghToken   !== undefined) fields[F.profils.gh_token]   = profil.ghToken
  if (profil.claudeKey !== undefined) fields[F.profils.claude_key] = profil.claudeKey
  await patch(AT_TABLES.profils, atId, token, fields)
}

// ─── Factures ─────────────────────────────────────────────────────────────────

export async function getFactures(token: string, userEmail: string): Promise<Invoice[]> {
  const records = await getAll(AT_TABLES.factures, token, `{${F.factures.user_email}}="${userEmail}"`)
  return records.map(rec => {
    const f = rec.fields
    let lignes: Invoice['lignes'] = []
    try {
      const raw = f[F.factures.prestation]
      if (typeof raw === 'string' && raw.startsWith('[')) lignes = JSON.parse(raw)
    } catch {}
    return {
      id:           rec.id,
      atId:         rec.id,
      num:          String(f[F.factures.num]          ?? ''),
      date:         String(f[F.factures.date]         ?? ''),
      echeance:     String(f[F.factures.echeance]     ?? ''),
      echeanceLabel:'',
      clientId:     '',
      clientNom:    String(f[F.factures.client_nom]   ?? ''),
      clientEmail:  String(f[F.factures.client_email] ?? ''),
      clientAdresse:'',
      clientSiret:  '',
      paiement:     String(f[F.factures.paiement]     ?? ''),
      iban:         '',
      notes:        String(f[F.factures.notes]        ?? ''),
      lignes,
      total:        Number(f[F.factures.montant]      ?? 0),
      statut:       (String(f[F.factures.statut]      ?? 'pending')) as Invoice['statut'],
      dateEnvoi:    f[F.factures.date_envoi]  ? String(f[F.factures.date_envoi])  : undefined,
      pdfUrl:       f[F.factures.pdf_url]     ? String(f[F.factures.pdf_url])     : undefined,
      emailEnvoye:  Boolean(f[F.factures.email_envoye]),
      userEmail:    String(f[F.factures.user_email]   ?? ''),
    }
  })
}

export async function createFacture(token: string, inv: Invoice, userEmail: string): Promise<string | null> {
  const rec = await create(AT_TABLES.factures, token, {
    [F.factures.num]:         inv.num,
    [F.factures.client_nom]:  inv.clientNom,
    [F.factures.client_email]:inv.clientEmail,
    [F.factures.montant]:     inv.total,
    [F.factures.date]:        inv.date,
    [F.factures.echeance]:    inv.echeance,
    [F.factures.statut]:      inv.statut,
    [F.factures.prestation]:  JSON.stringify(inv.lignes),
    [F.factures.paiement]:    inv.paiement,
    [F.factures.notes]:       inv.notes,
    [F.factures.user_email]:  userEmail,
  })
  return rec?.id ?? null
}

export async function updateFactureStatut(token: string, atId: string, statut: string): Promise<void> {
  await patch(AT_TABLES.factures, atId, token, { [F.factures.statut]: statut })
}

export async function updateFacturePdf(token: string, atId: string, pdfUrl: string): Promise<void> {
  await patch(AT_TABLES.factures, atId, token, {
    [F.factures.pdf_url]:      pdfUrl,
    [F.factures.email_envoye]: true,
    [F.factures.date_envoi]:   new Date().toISOString().split('T')[0],
  })
}

export async function deleteFacture(token: string, atId: string): Promise<void> {
  await del(AT_TABLES.factures, atId, token)
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getClients(token: string, userEmail: string): Promise<Client[]> {
  const records = await getAll(AT_TABLES.clients, token, `{${F.clients.user_email}}="${userEmail}"`)
  return records.map(rec => {
    const f = rec.fields
    return {
      id:        rec.id,
      atId:      rec.id,
      nom:       String(f[F.clients.nom]     ?? ''),
      email:     String(f[F.clients.email]   ?? ''),
      tel:       String(f[F.clients.tel]     ?? ''),
      adresse:   String(f[F.clients.adresse] ?? ''),
      siret:     String(f[F.clients.siret]   ?? ''),
      notes:     String(f[F.clients.notes]   ?? ''),
      userEmail: String(f[F.clients.user_email] ?? ''),
    }
  })
}

export async function createClient(token: string, client: Omit<Client, 'id' | 'atId'>, userEmail: string): Promise<string | null> {
  const rec = await create(AT_TABLES.clients, token, {
    [F.clients.nom]:       client.nom,
    [F.clients.email]:     client.email,
    [F.clients.tel]:       client.tel,
    [F.clients.adresse]:   client.adresse,
    [F.clients.siret]:     client.siret,
    [F.clients.notes]:     client.notes ?? '',
    [F.clients.user_email]:userEmail,
  })
  return rec?.id ?? null
}

export async function updateClient(token: string, atId: string, client: Partial<Client>): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (client.nom     !== undefined) fields[F.clients.nom]     = client.nom
  if (client.email   !== undefined) fields[F.clients.email]   = client.email
  if (client.tel     !== undefined) fields[F.clients.tel]     = client.tel
  if (client.adresse !== undefined) fields[F.clients.adresse] = client.adresse
  if (client.siret   !== undefined) fields[F.clients.siret]   = client.siret
  if (client.notes   !== undefined) fields[F.clients.notes]   = client.notes
  await patch(AT_TABLES.clients, atId, token, fields)
}

export async function deleteClient(token: string, atId: string): Promise<void> {
  await del(AT_TABLES.clients, atId, token)
}

// ─── Hub Messages ─────────────────────────────────────────────────────────────

export async function getHubMessages(token: string, userEmail: string): Promise<HubMessage[]> {
  const records = await getAll(AT_TABLES.hub_messages, token, `{${F.hub_messages.user_email}}="${userEmail}"`)
  return records.map(rec => {
    const f = rec.fields
    let tags: string[] = []
    try { tags = JSON.parse(String(f[F.hub_messages.tags] ?? '[]')) } catch {}
    return {
      id:            rec.id,
      source:        (String(f[F.hub_messages.source]   ?? 'email')) as HubMessage['source'],
      author:        String(f[F.hub_messages.author]    ?? ''),
      content:       String(f[F.hub_messages.content]   ?? ''),
      date:          String(f[F.hub_messages.date]      ?? ''),
      priority:      (String(f[F.hub_messages.priority] ?? 'medium')) as HubMessage['priority'],
      read:          Boolean(f[F.hub_messages.read]),
      tags,
      actionRequired:Boolean(f[F.hub_messages.action_required]),
      userEmail:     String(f[F.hub_messages.user_email] ?? ''),
    }
  })
}

// ─── Coaching ────────────────────────────────────────────────────────────────

export async function getCoachingSessions(token: string, userEmail: string): Promise<CoachingSession[]> {
  const records = await getAll(AT_TABLES.coaching, token, `{${F.coaching.user_email}}="${userEmail}"`)
  return records.map(rec => {
    const f = rec.fields
    return {
      id:           rec.id,
      atId:         rec.id,
      studentName:  String(f[F.coaching.student_name]  ?? ''),
      studentEmail: String(f[F.coaching.student_email] ?? ''),
      topic:        String(f[F.coaching.topic]         ?? ''),
      date:         String(f[F.coaching.date]          ?? ''),
      status:       (String(f[F.coaching.status] ?? 'scheduled')) as CoachingSession['status'],
      notes:        f[F.coaching.notes]      ? String(f[F.coaching.notes])      : undefined,
      aiSummary:    f[F.coaching.ai_summary] ? String(f[F.coaching.ai_summary]) : undefined,
      userEmail:    String(f[F.coaching.user_email] ?? ''),
    }
  })
}

export async function createCoachingSession(token: string, session: Omit<CoachingSession, 'id' | 'atId'>, userEmail: string): Promise<string | null> {
  const rec = await create(AT_TABLES.coaching, token, {
    [F.coaching.student_name]:  session.studentName,
    [F.coaching.student_email]: session.studentEmail,
    [F.coaching.topic]:         session.topic,
    [F.coaching.date]:          session.date,
    [F.coaching.status]:        session.status,
    [F.coaching.notes]:         session.notes ?? '',
    [F.coaching.user_email]:    userEmail,
  })
  return rec?.id ?? null
}
