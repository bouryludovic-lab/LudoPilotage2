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

// ─── Airtable Config ──────────────────────────────────────────────────────────

export const AT_BASE = 'appdpkBZRuqEWgOwB'

// Core tables: OLD IDs (existing data + field IDs)
// New tables: NEW IDs (new features, use field names)
export const AT_TABLES = {
  // ── existing tables with real data ──
  profils:      'tblrBTOVI4Vtyw7Yu',   // old profil table
  factures:     'tblg4GSn4VYEWym7U',   // old factures table
  clients:      'tblhyDbRE9EsehF8P',   // old clients table
  // ── new tables for new modules ──
  hub_messages: 'tblYMMsyFXwRh9m6T',
  coaching:     'tblmpUCHUkQXhbypC',
} as const

// Field IDs for existing tables (returnFieldsByFieldId=true)
// Field names for new tables (no returnFieldsByFieldId)
export const AT_FIELDS = {
  factures: {
    num:         'fldfWxfpMbfDx8C4r',
    client_nom:  'fldNfyOjAR0l0J26A',   // was "client"
    client_email:'fld5HBQXkvPuCuy0S',   // was "email"
    montant:     'fldcDOmXjgv5lcxUu',
    date:        'fldLKwukDFcqDTBcN',
    echeance:    'fldjDzETRbstPdDqG',
    statut:      'fld0dmKRy5LF17l8G',
    prestation:  'fldqN7CRQPzspMWjl',
    paiement:    'fldO41dH1Y4Z7Nf5E',
    notes:       'fldJphY2HZEcLyU8U',
    email_envoye:'fldQQFX8GjgST3GoH',
    date_envoi:  'fldRrEv5qZuSRKNQG',
    pdf:        'fld0STwue4xaMjOwX',
    pdf_url:    'fldWERkkMOXVg6efx',
  },
  clients: {
    nom:     'fldKAzAwGwPPtAmR0',
    email:   'fld8N9FpM3QlyXBxI',
    tel:     'fldklBTwFzp1G5CE5',
    adresse: 'fldOGf87J5w3nYIQ5',
    siret:   'fldxzOntFLchVyIJb',
    ca:      'fldhTrfiVkr2uImEN',
    notes:   'fldjKYVeJC6gnlRIb',
  },
  profils: {
    nom:     'fldNgVkNEOVtWfFdZ',
    siret:   'fld2zcuPKXeIDnrYJ',
    adresse: 'fld1NSImbC9MhFlwr',
    email:   'fld7WhHvhrRDHeJ75',
    tel:     'fldthrvLySFe5e5CR',
    iban:    'fldWeehG4d2TibX1p',
    prefix:  'fld7qz7VqdYpdjcVf',
    pin:     'fldlA797JhQZDCWPb',
    token:   'fldWDPsM4ssVgaq2e',
    logo:    'fldLOGO00000000001',
  },
  // New tables use field names (no field IDs)
  hub_messages: {
    name:            'Name',
    source:          'source',
    author:          'author',
    content:         'content',
    date:            'date',
    priority:        'priority',
    read:            'read',
    tags:            'tags',
    user_email:      'user_email',
    action_required: 'action_required',
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
