import { AT_FIELDS, AT_TABLES, type Client, type Invoice, type Profil, type TableName } from './types'
import { storage } from './storage'

// ─── Core client — all reads/writes go through the server proxy /api/airtable
//     (AIRTABLE_TOKEN lives server-side; at_token in the browser is the user's
//     email, used only to scope records) ─────────────────────────────────────

function userEmail(): string {
  return storage.getToken()
}

async function atProxy(body: Record<string, unknown>) {
  const res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof d.error === 'string' ? d.error : `Airtable ${res.status}`)
  return d
}

async function create(table: string, fields: Record<string, unknown>) {
  const d = await atProxy({ table, method: 'POST', fields })
  return d.records?.[0] ?? null
}

async function update(table: string, id: string, fields: Record<string, unknown>) {
  return atProxy({ table, method: 'PATCH', id, fields })
}

async function del(table: string, id: string) {
  await atProxy({ table, method: 'DELETE', id })
}

const F = AT_FIELDS

// ─── CRUD wrappers ────────────────────────────────────────────────────────────

export async function createClient(client: Omit<Client, 'id' | 'atId'>): Promise<string | null> {
  const rec = await create(AT_TABLES.clients, {
    [F.clients.nom]:        client.nom,
    [F.clients.email]:      client.email,
    [F.clients.tel]:        client.tel,
    [F.clients.adresse]:    client.adresse,
    [F.clients.siret]:      client.siret,
    [F.clients.notes]:      client.notes ?? '',
    // user_email scopes the record to this account — without it the record
    // is invisible to sync and would vanish from the app on next refresh
    [F.clients.user_email]: userEmail(),
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
    [F.factures.user_email]:  userEmail(),
  })
  return rec?.id ?? null
}

export async function updateFactureStatut(atId: string, statut: string) {
  return update(AT_TABLES.factures, atId, { [F.factures.statut]: statut })
}

export async function markFactureSent(atId: string) {
  return update(AT_TABLES.factures, atId, {
    [F.factures.email_envoye]: true,
    [F.factures.date_envoi]:   new Date().toISOString().split('T')[0],
  })
}

export async function deleteFacture(atId: string) {
  return del(AT_TABLES.factures, atId)
}

export async function updateProfilInAirtable(atId: string, profil: Partial<Profil>) {
  const fields: Record<string, unknown> = {}
  if (profil.nom     !== undefined) fields[F.profils.nom]     = profil.nom
  if (profil.siret   !== undefined) fields[F.profils.siret]   = profil.siret
  if (profil.adresse !== undefined) fields[F.profils.adresse] = profil.adresse
  if (profil.email   !== undefined) fields[F.profils.email]   = profil.email
  if (profil.tel     !== undefined) fields[F.profils.tel]     = profil.tel
  if (profil.iban    !== undefined) fields[F.profils.iban]    = profil.iban
  if (profil.prefix  !== undefined) fields[F.profils.prefix]  = profil.prefix
  // design is stored as a JSON string in the 'design' field
  if (profil.design  !== undefined) fields['design'] = typeof profil.design === 'string'
    ? profil.design
    : JSON.stringify(profil.design)
  return update(AT_TABLES.profils, atId, fields)
}

// ─── Make webhook ─────────────────────────────────────────────────────────────

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
