'use client'

import { create } from 'zustand'
import { storage } from '@/lib/storage'
import { syncClients, syncFactures, syncProfil } from '@/lib/airtable'
import type { Client, Config, Invoice, InvoiceStatus, Profil } from '@/lib/types'
import { uid } from '@/lib/utils'

interface AppState {
  // ── Data ────────────────────────────────────────────────────────────────────
  factures:  Invoice[]
  clients:   Client[]
  profil:    Profil
  config:    Config

  // ── UI State ─────────────────────────────────────────────────────────────────
  syncing: boolean
  syncError: string | null
  lastSyncAt: Date | null

  // ── Actions ──────────────────────────────────────────────────────────────────
  loadFromStorage: () => void
  syncAll: () => Promise<void>

  // Factures
  addFacture:    (f: Invoice) => void
  updateFacture: (id: string, patch: Partial<Invoice>) => void
  deleteFacture: (id: string) => void
  setFactures:   (f: Invoice[]) => void

  // Clients
  addClient:    (c: Client) => void
  updateClient: (id: string, patch: Partial<Client>) => void
  deleteClient: (id: string) => void
  setClients:   (c: Client[]) => void

  // Profil
  setProfil: (p: Profil) => void

  // Config
  setConfig: (c: Config) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  factures:   [],
  clients:    [],
  profil:     { nom: '', siret: '', adresse: '', email: '', tel: '', iban: '', prefix: 'F-' },
  config:     {},
  syncing:    false,
  syncError:  null,
  lastSyncAt: null,

  // ── Load from localStorage on mount ─────────────────────────────────────────
  loadFromStorage: () => {
    set({
      factures: storage.getFactures(),
      clients:  storage.getClients(),
      profil:   storage.getProfil(),
      config:   storage.getConfig(),
    })
  },

  // ── Full Airtable sync ───────────────────────────────────────────────────────
  syncAll: async () => {
    set({ syncing: true, syncError: null })
    try {
      const [clients, factures, profil] = await Promise.all([
        syncClients(),
        syncFactures(),
        syncProfil(),
      ])

      // Merge: keep local-only records (no atId), overwrite synced ones
      const localFactures  = get().factures.filter(f => !f.atId)
      const localClients   = get().clients.filter(c => !c.atId)

      const mergedFactures = [...factures, ...localFactures]
      const mergedClients  = [...clients,  ...localClients]

      storage.setFactures(mergedFactures)
      storage.setClients(mergedClients)
      if (profil) storage.setProfil(profil)

      set({
        factures:   mergedFactures,
        clients:    mergedClients,
        profil:     profil ?? get().profil,
        syncing:    false,
        lastSyncAt: new Date(),
      })
    } catch (e) {
      set({ syncing: false, syncError: e instanceof Error ? e.message : 'Erreur de sync' })
      throw e
    }
  },

  // ── Factures ─────────────────────────────────────────────────────────────────
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

  setFactures: (factures) => {
    storage.setFactures(factures)
    set({ factures })
  },

  // ── Clients ──────────────────────────────────────────────────────────────────
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

  setClients: (clients) => {
    storage.setClients(clients)
    set({ clients })
  },

  // ── Profil ───────────────────────────────────────────────────────────────────
  setProfil: (profil) => {
    storage.setProfil(profil)
    set({ profil })
  },

  // ── Config ───────────────────────────────────────────────────────────────────
  setConfig: (config) => {
    storage.setConfig(config)
    set({ config })
  },
}))

// ─── Derived selectors ────────────────────────────────────────────────────────

export const selectPendingCount = (s: AppState) =>
  s.factures.filter(f => f.statut === 'pending' || f.statut === 'sent').length

export const selectTotalCA = (s: AppState) =>
  s.factures.filter(f => f.statut === 'paid').reduce((acc, f) => acc + f.total, 0)

export const selectPendingAmount = (s: AppState) =>
  s.factures
    .filter(f => f.statut === 'pending' || f.statut === 'sent')
    .reduce((acc, f) => acc + f.total, 0)

export const selectRecentInvoices = (limit: number) => (s: AppState) =>
  [...s.factures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
