'use client'

import { create } from 'zustand'
import { storage } from '@/lib/storage'
import type { Client, Config, Invoice, Profil } from '@/lib/types'
import { uid } from '@/lib/utils'

interface AppState {
  factures:   Invoice[]
  clients:    Client[]
  profil:     Profil
  config:     Config

  syncing:    boolean
  syncError:  string | null
  lastSyncAt: Date | null

  loadFromStorage: () => void
  syncAll:         () => Promise<void>

  addFacture:    (f: Invoice) => void
  updateFacture: (id: string, patch: Partial<Invoice>) => void
  deleteFacture: (id: string) => void
  setFactures:   (f: Invoice[]) => void

  addClient:    (c: Client) => void
  updateClient: (id: string, patch: Partial<Client>) => void
  deleteClient: (id: string) => void
  setClients:   (c: Client[]) => void

  setProfil: (p: Profil) => void
  setConfig: (c: Config) => void
}

// ─── Server-side sync via proxy ───────────────────────────────────────────────

async function atProxy(body: Record<string, unknown>) {
  const res = await fetch('/api/airtable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Proxy ${res.status}`)
  return res.json()
}

async function serverSyncAll(): Promise<{ factures: Invoice[]; clients: Client[]; profil: Profil | null }> {
  const { AT_TABLES, AT_FIELDS } = await import('@/lib/types')
  const F = AT_FIELDS

  // Detect user email from storage
  const userEmail = typeof window !== 'undefined' ? (localStorage.getItem('at_token') ?? '') : ''

  const [facturesData, clientsData, profilData] = await Promise.all([
    atProxy({ table: AT_TABLES.factures, method: 'GET', useFieldNames: true,
      query: userEmail ? `filterByFormula=${encodeURIComponent(`{${F.factures.user_email}}="${userEmail}"`)}` : undefined }),
    atProxy({ table: AT_TABLES.clients,  method: 'GET', useFieldNames: true,
      query: userEmail ? `filterByFormula=${encodeURIComponent(`{${F.clients.user_email}}="${userEmail}"`)}` : undefined }),
    atProxy({ table: AT_TABLES.profils,  method: 'GET', useFieldNames: true,
      query: userEmail ? `filterByFormula=${encodeURIComponent(`{${F.profils.email}}="${userEmail}"`)}` : undefined }),
  ])

  const factures: Invoice[] = (facturesData.records ?? []).map((rec: { id: string; fields: Record<string, unknown> }) => {
    const f = rec.fields
    let lignes: Invoice['lignes'] = []
    try {
      const raw = f[F.factures.prestation]
      if (typeof raw === 'string' && raw.startsWith('[')) lignes = JSON.parse(raw)
    } catch {}
    return {
      id: rec.id, atId: rec.id,
      num:         String(f[F.factures.num]          ?? ''),
      date:        String(f[F.factures.date]         ?? ''),
      echeance:    String(f[F.factures.echeance]     ?? ''),
      echeanceLabel: '',
      clientId:    '',
      clientNom:   String(f[F.factures.client_nom]   ?? ''),
      clientEmail: String(f[F.factures.client_email] ?? ''),
      clientAdresse: '', clientSiret: '',
      paiement:    String(f[F.factures.paiement]     ?? ''),
      iban: '',
      notes:       String(f[F.factures.notes]        ?? ''),
      lignes,
      total:       Number(f[F.factures.montant]      ?? 0),
      statut:      (String(f[F.factures.statut]      ?? 'pending')) as Invoice['statut'],
      dateEnvoi:   f[F.factures.date_envoi] ? String(f[F.factures.date_envoi]) : undefined,
      pdfUrl:      f[F.factures.pdf_url]    ? String(f[F.factures.pdf_url])    : undefined,
      emailEnvoye: Boolean(f[F.factures.email_envoye]),
      userEmail:   String(f[F.factures.user_email]   ?? ''),
    }
  })

  const clients: Client[] = (clientsData.records ?? []).map((rec: { id: string; fields: Record<string, unknown> }) => {
    const f = rec.fields
    return {
      id: rec.id, atId: rec.id,
      nom:     String(f[F.clients.nom]     ?? ''),
      email:   String(f[F.clients.email]   ?? ''),
      tel:     String(f[F.clients.tel]     ?? ''),
      adresse: String(f[F.clients.adresse] ?? ''),
      siret:   String(f[F.clients.siret]   ?? ''),
      notes:   String(f[F.clients.notes]   ?? ''),
    }
  })

  let profil: Profil | null = null
  if ((profilData.records ?? []).length > 0) {
    const rec = profilData.records[0]
    const f = rec.fields
    profil = {
      atId:    rec.id,
      nom:     String(f[F.profils.nom]     ?? ''),
      email:   String(f[F.profils.email]   ?? ''),
      siret:   String(f[F.profils.siret]   ?? ''),
      adresse: String(f[F.profils.adresse] ?? ''),
      tel:     String(f[F.profils.tel]     ?? ''),
      iban:    String(f[F.profils.iban]    ?? ''),
      prefix:  String(f[F.profils.prefix]  ?? 'F-'),
      webhook: f[F.profils.webhook]   ? String(f[F.profils.webhook])   : undefined,
      ghToken: f[F.profils.gh_token]  ? String(f[F.profils.gh_token])  : undefined,
    }
  }

  return { factures, clients, profil }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  factures:   [],
  clients:    [],
  profil:     { nom: '', siret: '', adresse: '', email: '', tel: '', iban: '', prefix: 'F-' },
  config:     {},
  syncing:    false,
  syncError:  null,
  lastSyncAt: null,

  loadFromStorage: () => {
    set({
      factures: storage.getFactures(),
      clients:  storage.getClients(),
      profil:   storage.getProfil(),
      config:   storage.getConfig(),
    })
  },

  syncAll: async () => {
    set({ syncing: true, syncError: null })
    try {
      const { factures, clients, profil } = await serverSyncAll()
      const localFactures = get().factures.filter(f => !f.atId)
      const localClients  = get().clients.filter(c => !c.atId)
      const merged = {
        factures:   [...factures, ...localFactures],
        clients:    [...clients, ...localClients],
        profil:     profil ?? get().profil,
        syncing:    false,
        lastSyncAt: new Date(),
      }
      storage.setFactures(merged.factures)
      storage.setClients(merged.clients)
      if (profil) storage.setProfil(profil)
      set(merged)
    } catch (e) {
      set({ syncing: false, syncError: e instanceof Error ? e.message : 'Erreur sync' })
      throw e
    }
  },

  addFacture: (f) => {
    const next = [...get().factures, f]
    storage.setFactures(next)
    set({ factures: next })
  },
  updateFacture: (id, patch) => {
    const next = get().factures.map(f => f.id === id ? { ...f, ...patch } : f)
    storage.setFactures(next)
    set({ factures: next })
  },
  deleteFacture: (id) => {
    const next = get().factures.filter(f => f.id !== id)
    storage.setFactures(next)
    set({ factures: next })
  },
  setFactures: (factures) => { storage.setFactures(factures); set({ factures }) },

  addClient: (c) => {
    const next = [...get().clients, c]
    storage.setClients(next)
    set({ clients: next })
  },
  updateClient: (id, patch) => {
    const next = get().clients.map(c => c.id === id ? { ...c, ...patch } : c)
    storage.setClients(next)
    set({ clients: next })
  },
  deleteClient: (id) => {
    const next = get().clients.filter(c => c.id !== id)
    storage.setClients(next)
    set({ clients: next })
  },
  setClients: (clients) => { storage.setClients(clients); set({ clients }) },

  setProfil: (profil) => { storage.setProfil(profil); set({ profil }) },
  setConfig:  (config) =>  { storage.setConfig(config);  set({ config }) },
}))

export const selectPendingCount  = (s: AppState) => s.factures.filter(f => f.statut === 'pending' || f.statut === 'sent').length
export const selectTotalCA       = (s: AppState) => s.factures.filter(f => f.statut === 'paid').reduce((a, f) => a + f.total, 0)
export const selectPendingAmount = (s: AppState) => s.factures.filter(f => f.statut === 'pending' || f.statut === 'sent').reduce((a, f) => a + f.total, 0)
export const selectRecentInvoices = (n: number) => (s: AppState) => [...s.factures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, n)
