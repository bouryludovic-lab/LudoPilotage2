// ─── Data Models ────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'error' | 'overdue'

export interface LineItem {
  desc: string
  qte: number
  pu: number
}

export interface Invoice {
  id: string
  atId?: string
  num: string
  date: string
  echeance: string
  echeanceLabel: string
  clientId: string
  clientNom: string
  clientEmail: string
  clientAdresse: string
  clientSiret: string
  paiement: string
  iban: string
  notes: string
  lignes: LineItem[]
  total: number
  statut: InvoiceStatus
  dateEnvoi?: string
  pdfUrl?: string
  emailEnvoye?: boolean
  userEmail?: string
}

export interface Client {
  id: string
  atId?: string
  nom: string
  email: string
  tel: string
  adresse: string
  siret: string
  notes?: string
  userEmail?: string
}

export interface InvoiceDesign {
  /** Header background color, hex e.g. "#1a2744" */
  primaryColor: string
  /** Badge / accent color, hex e.g. "#2563eb" */
  accentColor:  string
  /** Tagline shown under company name */
  tagline:      string
  /** Bank institution name */
  bankName:     string
  /** BIC / SWIFT code */
  bic:          string
  /** Account holder (if different from nom) */
  titulaire:    string
  /** Extra RIB info: "Banque: X | Guichet: Y | Compte: Z | Clé RIB: W" */
  bankDetails:  string
}

export const DEFAULT_DESIGN: InvoiceDesign = {
  primaryColor: '#1a2744',
  accentColor:  '#2563eb',
  tagline:      'CONSULTING & STRATEGY',
  bankName:     '',
  bic:          '',
  titulaire:    '',
  bankDetails:  '',
}

export interface Profil {
  atId?: string
  nom: string
  siret: string
  adresse: string
  email: string
  tel: string
  iban: string
  prefix: string
  logo?: string
  pin?: string
  webhook?: string
  ghToken?: string
  claudeKey?: string
  /** Invoice visual design & bank details */
  design?: InvoiceDesign
}

export interface Config {
  webhook?: string
  token?: string
  claudeKey?: string
  ghToken?: string
}

// ─── New SaaS Models ─────────────────────────────────────────────────────────

export type HubSource = 'circle' | 'slack' | 'whatsapp' | 'email' | 'notion'
export type HubPriority = 'high' | 'medium' | 'low'

export interface HubMessage {
  id: string
  source: HubSource
  author: string
  content: string
  date: string
  priority: HubPriority
  read: boolean
  tags: string[]
  actionRequired?: boolean
  userEmail?: string
}

export interface AIAgent {
  id: string
  name: string
  description: string
  systemPrompt: string
  model: string
  active: boolean
  createdAt: string
  conversations?: number
}

export interface FormField {
  id: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'date' | 'email'
  label: string
  placeholder?: string
  required?: boolean
  options?: string[]
}

export interface FormTemplate {
  id: string
  name: string
  description: string
  fields: FormField[]
  createdAt: string
  submissions?: number
}

export interface CoachingSession {
  id: string
  atId?: string
  studentName: string
  studentEmail: string
  topic: string
  date: string
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  aiSummary?: string
  userEmail?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─── Invoice template (defaults for new invoices, stored in localStorage) ────

export interface InvoiceTemplate {
  paiement:    string
  echeanceIdx: number
  notes:       string
  lignes:      LineItem[]
}

// ─── Airtable Config ─────────────────────────────────────────────────────────

export const AT_BASE = 'appdpkBZRuqEWgOwB'

// New tables (fresh, use field names)
export const AT_TABLES = {
  profils:      'tblxiuLqflhdTdW6n',
  factures:     'tbl23gpQ2ypeXRymQ',
  clients:      'tblMJYQpS4iqz9MJt',
  hub_messages: 'tblYMMsyFXwRh9m6T',
  coaching:     'tblmpUCHUkQXhbypC',
} as const

// Field names for new tables (no field ID mapping needed)
export const AT_FIELDS = {
  profils: {
    nom:       'Name',
    email:     'email',
    siret:     'siret',
    adresse:   'adresse',
    tel:       'tel',
    iban:      'iban',
    prefix:    'prefix',
    pin:       'pin',
    webhook:   'webhook',
    gh_token:  'gh_token',
    claude_key:'claude_key',
  },
  factures: {
    num:         'Name',
    client_nom:  'client_nom',
    client_email:'client_email',
    montant:     'montant',
    date:        'date',
    echeance:    'echeance',
    statut:      'statut',
    prestation:  'prestation',
    paiement:    'paiement',
    notes:       'notes',
    email_envoye:'email_envoye',
    date_envoi:  'date_envoi',
    pdf_url:     'pdf_url',
    user_email:  'user_email',
  },
  clients: {
    nom:       'Name',
    email:     'email',
    tel:       'tel',
    adresse:   'adresse',
    siret:     'siret',
    notes:     'notes',
    user_email:'user_email',
  },
  hub_messages: {
    name:           'Name',
    source:         'source',
    author:         'author',
    content:        'content',
    date:           'date',
    priority:       'priority',
    read:           'read',
    tags:           'tags',
    user_email:     'user_email',
    action_required:'action_required',
  },
  coaching: {
    student_name:  'Name',
    student_email: 'student_email',
    topic:         'topic',
    date:          'date',
    status:        'status',
    notes:         'notes',
    ai_summary:    'ai_summary',
    user_email:    'user_email',
  },
} as const

export type TableName = keyof typeof AT_TABLES
