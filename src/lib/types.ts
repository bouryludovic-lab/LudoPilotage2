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
  date: string           // ISO date string
  echeance: string       // ISO date string
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
  logo?: string  // base64 data URL
}

export interface Config {
  webhook?: string
  token?: string
  claudeKey?: string
  ghToken?: string
}

// ─── Airtable Field Maps ─────────────────────────────────────────────────────

export const AT_BASE = 'appdpkBZRuqEWgOwB'

export const AT_TABLES = {
  factures: 'tblg4GSn4VYEWym7U',
  clients:  'tblhyDbRE9EsehF8P',
  profil:   'tblrBTOVI4Vtyw7Yu',
} as const

export const AT_FIELDS = {
  factures: {
    num:        'fldfWxfpMbfDx8C4r',
    client:     'fldNfyOjAR0l0J26A',
    lienClient: 'fldtEKdVOZBsxg8DF',
    montant:    'fldcDOmXjgv5lcxUu',
    date:       'fldLKwukDFcqDTBcN',
    echeance:   'fldjDzETRbstPdDqG',
    statut:     'fld0dmKRy5LF17l8G',
    prestation: 'fldqN7CRQPzspMWjl',
    paiement:   'fldO41dH1Y4Z7Nf5E',
    email:      'fld5HBQXkvPuCuy0S',
    notes:      'fldJphY2HZEcLyU8U',
    emailEnvoye:'fldQQFX8GjgST3GoH',
    dateEnvoi:  'fldRrEv5qZuSRKNQG',
    pdf:        'fld0STwue4xaMjOwX',
    pdfUrl:     'fldWERkkMOXVg6efx',
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
  profil: {
    cle:     'fldZAYBVDqd6ygtDZ',
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
} as const

export type TableName = keyof typeof AT_TABLES
