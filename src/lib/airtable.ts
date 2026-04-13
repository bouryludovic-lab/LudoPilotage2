import { AT_BASE, AT_FIELDS, AT_TABLES, type Client, type Invoice, type Profil, type TableName } from './types'
import { storage } from './storage'

// ─── Core Airtable client ─────────────────────────────────────────────────────

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${storage.getToken()}`,
    'Content-Type': 'application/json',
  }
}

function url(table: string, id = '') {
  return `https://api.airtable.com/v0/${AT_BASE}/${table}${id ? '/' + id : ''}`
}

async function getAll(table: string): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  if (!storage.getToken()) return []
  const records: Array<{ id: string; fields: Record<string, unknown> }> = []
  let offset: string | null = null

  do {
    const u = url(table) + '?pageSize=100' + (offset ? '&offset=' + offset : '')
    const r = await fetch(u, { headers: headers() })
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${r.statusText}`)
    const d = await r.json()
    const normalized = (d.records ?? []).map((rec: { id: string; fields?: Record<string, unknown>; cellValuesByFieldId?: Record<string, unknown> }) => ({
      id: rec.id,
      fields: rec.fields ?? rec.cellValuesByFieldId ?? {},
    }))
    records.push(...normalized)
    offset = d.offset ?? null
  } while (offset)

  return records
}

async function create(table: string, fields: Record<string, unknown>) {
  if (!storage.getToken()) return null
  const r = await fetch(url(table), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ records: [{ fields }] }),
  })
  if (!r.ok) throw new Error(`Airtable create ${r.status}`)
  const d = await r.json()
  return d.records?.[0] ?? null
}

async function update(table: string, id: string, fields: Record<string, unknown>) {
  if (!storage.getToken()) return null
  const r = await fetch(url(table, id), {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Airtable update ${r.status}`)
  return await r.json()
}

async function del(table: string, id: string) {
  if (!storage.getToken()) return
  const r = await fetch(url(table, id), { method: 'DELETE', headers: headers() })
  if (!r.ok) throw new Error(`Airtable delete ${r.status}`)
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

export async function fetchProfilByBootstrapToken(bootstrapToken: string): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const r = await fetch(url(AT_TABLES.profil), {
    headers: {
      Authorization: `Bearer ${bootstrapToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!r.ok) throw new Error('Token invalide')
  const d = await r.json()
  return (d.records ?? []).map((rec: { id: string; fields?: Record<string, unknown>; cellValuesByFieldId?: Record<string, unknown> }) => ({
    id: rec.id,
    fields: rec.fields ?? rec.cellValuesByFieldId ?? {},
  }))
}

// ─── Domain sync ─────────────────────────────────────────────────────────────

const F = AT_FIELDS

export async function syncClients(): Promise<Client[]> {
  const records = await getAll(AT_TABLES.clients)
  return records.map(rec => ({
    id:      rec.id,
    atId:    rec.id,
    nom:     String(rec.fields[F.clients.nom]     ?? ''),
    email:   String(rec.fields[F.clients.email]   ?? ''),
    tel:     String(rec.fields[F.clients.tel]      ?? ''),
    adresse: String(rec.fields[F.clients.adresse]  ?? ''),
    siret:   String(rec.fields[F.clients.siret]    ?? ''),
    notes:   String(rec.fields[F.clients.notes]    ?? ''),
  }))
}

export async function syncFactures(): Promise<Invoice[]> {
  const records = await getAll(AT_TABLES.factures)
  return records.map(rec => {
    const f = rec.fields
    let lignes: Invoice['lignes'] = []
    try {
      const raw = f[F.factures.prestation]
      if (typeof raw === 'string' && raw.startsWith('[')) {
        lignes = JSON.parse(raw)
      }
    } catch {}

    const total = Number(f[F.factures.montant] ?? 0)
    return {
      id:           rec.id,
      atId:         rec.id,
      num:          String(f[F.factures.num]          ?? ''),
      date:         String(f[F.factures.date]         ?? ''),
      echeance:     String(f[F.factures.echeance]     ?? ''),
      echeanceLabel:'',
      clientId:     '',
      clientNom:    String(f[F.factures.client]       ?? ''),
      clientEmail:  String(f[F.factures.email]        ?? ''),
      clientAdresse:'',
      clientSiret:  '',
      paiement:     String(f[F.factures.paiement]     ?? ''),
      iban:         '',
      notes:        String(f[F.factures.notes]        ?? ''),
      lignes,
      total,
      statut:       (String(f[F.factures.statut] ?? 'pending')) as Invoice['statut'],
      dateEnvoi:    f[F.factures.dateEnvoi] ? String(f[F.factures.dateEnvoi]) : undefined,
      pdfUrl:       f[F.factures.pdfUrl]    ? String(f[F.factures.pdfUrl])    : undefined,
      emailEnvoye:  Boolean(f[F.factures.emailEnvoye]),
    }
  })
}

export async function syncProfil(): Promise<Profil | null> {
  const records = await getAll(AT_TABLES.profil)
  if (!records.length) return null
  const rec = records[0]
  const f = rec.fields
  return {
    atId:    rec.id,
    nom:     String(f[F.profil.nom]     ?? ''),
    siret:   String(f[F.profil.siret]   ?? ''),
    adresse: String(f[F.profil.adresse] ?? ''),
    email:   String(f[F.profil.email]   ?? ''),
    tel:     String(f[F.profil.tel]     ?? ''),
    iban:    String(f[F.profil.iban]    ?? ''),
    prefix:  String(f[F.profil.prefix]  ?? 'F-'),
    logo:    f[F.profil.logo] ? String(f[F.profil.logo]) : undefined,
  }
}

// ─── CRUD wrappers ────────────────────────────────────────────────────────────

export async function createClient(client: Omit<Client, 'id' | 'atId'>): Promise<string | null> {
  const rec = await create(AT_TABLES.clients, {
    [F.clients.nom]:     client.nom,
    [F.clients.email]:   client.email,
    [F.clients.tel]:     client.tel,
    [F.clients.adresse]: client.adresse,
    [F.clients.siret]:   client.siret,
    [F.clients.notes]:   client.notes ?? '',
  })
  return rec?.id ?? null
}

export async function updateClient(atId: string, client: Partial<Client>) {
  const fields: Record<string, unknown> = {}
  if (client.nom     !== undefined) fields[F.clients.nom]     = client.nom
  if (client.email   !== undefined) fields[F.clients.email]   = client.email
  if (client.tel     !== undefined) fields[F.clients.tel]     = client.tel
  if (client.adresse !== undefined) fields[F.clients.adresse] = client.adresse
  if (client.siret   !== undefined) fields[F.clients.siret]   = client.siret
  if (client.notes   !== undefined) fields[F.clients.notes]   = client.notes
  return update(AT_TABLES.clients, atId, fields)
}

export async function deleteClient(atId: string) {
  return del(AT_TABLES.clients, atId)
}

export async function createFacture(inv: Invoice): Promise<string | null> {
  const rec = await create(AT_TABLES.factures, {
    [F.factures.num]:        inv.num,
    [F.factures.client]:     inv.clientNom,
    [F.factures.montant]:    inv.total,
    [F.factures.date]:       inv.date,
    [F.factures.echeance]:   inv.echeance,
    [F.factures.statut]:     inv.statut,
    [F.factures.prestation]: JSON.stringify(inv.lignes),
    [F.factures.paiement]:   inv.paiement,
    [F.factures.email]:      inv.clientEmail,
    [F.factures.notes]:      inv.notes,
  })
  return rec?.id ?? null
}

export async function updateFactureStatut(atId: string, statut: string) {
  return update(AT_TABLES.factures, atId, { [F.factures.statut]: statut })
}

export async function updateFacturePdfUrl(atId: string, pdfUrl: string) {
  return update(AT_TABLES.factures, atId, {
    [F.factures.pdfUrl]:     pdfUrl,
    [F.factures.emailEnvoye]: true,
    [F.factures.dateEnvoi]:  new Date().toISOString().split('T')[0],
  })
}

export async function deleteFacture(atId: string) {
  return del(AT_TABLES.factures, atId)
}

export async function updateProfilInAirtable(atId: string, profil: Partial<Profil>) {
  const fields: Record<string, unknown> = {}
  if (profil.nom     !== undefined) fields[F.profil.nom]     = profil.nom
  if (profil.siret   !== undefined) fields[F.profil.siret]   = profil.siret
  if (profil.adresse !== undefined) fields[F.profil.adresse] = profil.adresse
  if (profil.email   !== undefined) fields[F.profil.email]   = profil.email
  if (profil.tel     !== undefined) fields[F.profil.tel]     = profil.tel
  if (profil.iban    !== undefined) fields[F.profil.iban]    = profil.iban
  if (profil.prefix  !== undefined) fields[F.profil.prefix]  = profil.prefix
  return update(AT_TABLES.profil, atId, fields)
}

// ─── GitHub PDF upload ───────────────────────────────────────────────────────

export async function uploadPdfToGitHub(
  filename: string,
  base64Content: string,
  ghToken: string,
): Promise<string> {
  const owner = 'bouryludovic-lab'
  const repo  = 'LudoPilotage2'
  const path  = `factures/${filename}`
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  let sha: string | undefined
  try {
    const check = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (check.ok) {
      const data = await check.json()
      sha = data.sha
    }
  } catch {}

  const body: Record<string, unknown> = {
    message: `Add invoice ${filename}`,
    content: base64Content,
  }
  if (sha) body.sha = sha

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`GitHub upload failed: ${res.status}`)
  return `https://${owner}.github.io/${repo}/${path}`
}

// ─── Make webhook (email + AI) ────────────────────────────────────────────────

export async function sendViaWebhook(webhookUrl: string, payload: Record<string, unknown>) {
  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`Webhook error: ${r.status}`)
  return r
}

export { TableName }
