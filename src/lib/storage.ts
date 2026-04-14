import type { Client, Config, Invoice, InvoiceTemplate, Profil } from './types'

// ─── Safe localStorage / sessionStorage wrappers ─────────────────────────────

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

  /**
   * Save the auth token.
   * persist=true  → localStorage  (survives browser close — "rester connecté")
   * persist=false → sessionStorage (cleared when browser/tab closes)
   */
  setToken: (token: string, persist = true): void => {
    if (typeof window === 'undefined') return
    if (persist) {
      localStorage.setItem('at_token', token)
      sessionStorage.removeItem('at_token')
    } else {
      sessionStorage.setItem('at_token', token)
      localStorage.removeItem('at_token')
    }
    // Remember user's preference for next time
    localStorage.setItem('at_stay', persist ? '1' : '0')
  },

  getToken: (): string => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('at_token') ?? sessionStorage.getItem('at_token') ?? ''
  },

  /** Whether the user previously chose "stay logged in" */
  getStayLoggedIn: (): boolean => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('at_stay') !== '0'
  },

  clearToken: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('at_token')
    sessionStorage.removeItem('at_token')
  },

  isLoggedIn: (): boolean => {
    if (typeof window === 'undefined') return false
    return !!(localStorage.getItem('at_token') || sessionStorage.getItem('at_token'))
  },

  logout: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('at_token')
    sessionStorage.removeItem('at_token')
    // Keep 'at_stay' preference so checkbox remembers user choice
  },

  getBootstrapToken: (): string => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('at_bootstrap') ?? ''
  },
  setBootstrapToken: (token: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem('at_bootstrap', token)
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  getFactures:  (): Invoice[]       => get<Invoice[]>('factures', []),
  setFactures:  (v: Invoice[])      => set('factures', v),

  getClients:   (): Client[]        => get<Client[]>('clients', []),
  setClients:   (v: Client[])       => set('clients', v),

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
