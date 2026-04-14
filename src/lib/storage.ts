import type { Client, Config, Invoice, InvoiceTemplate, Profil } from './types'

// ─── Safe localStorage wrapper ───────────────────────────────────────────────

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('localStorage write failed', e)
  }
}

function remove(key: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export const storage = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  getToken: (): string => localStorage.getItem('at_token') ?? '',
  setToken: (token: string) => localStorage.setItem('at_token', token),
  clearToken: () => remove('at_token'),

  getBootstrapToken: (): string => localStorage.getItem('at_bootstrap') ?? '',
  setBootstrapToken: (token: string) => localStorage.setItem('at_bootstrap', token),

  isLoggedIn: (): boolean => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem('at_token')
  },

  logout: () => {
    remove('at_token')
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  getFactures:  (): Invoice[] => get<Invoice[]>('factures', []),
  setFactures:  (v: Invoice[]) => set('factures', v),

  getClients:   (): Client[]  => get<Client[]>('clients', []),
  setClients:   (v: Client[])  => set('clients', v),

  getProfil: (): Profil => get<Profil>('profil', {
    nom: '', siret: '', adresse: '', email: '', tel: '', iban: '', prefix: 'F-',
  }),
  setProfil: (v: Profil) => set('profil', v),

  getConfig: (): Config => get<Config>('config', {}),
  setConfig: (v: Config) => set('config', v),

  getTemplate: (): InvoiceTemplate => get<InvoiceTemplate>('invoice_template', {
    paiement:    'Virement bancaire',
    echeanceIdx: 2,
    notes:       '',
    lignes:      [{ desc: '', qte: 1, pu: 0 }],
  }),
  setTemplate: (v: InvoiceTemplate) => set('invoice_template', v),
}
