import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { InvoiceStatus } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

// ─── Invoice number generation ───────────────────────────────────────────────

export function generateInvoiceNum(prefix: string, existingNums: string[]): string {
  const year = new Date().getFullYear()
  const yearStr = String(year)

  const used = existingNums
    .filter(n => n.includes(yearStr))
    .map(n => {
      const parts = n.split('-')
      return parseInt(parts[parts.length - 1], 10) || 0
    })

  const next = used.length > 0 ? Math.max(...used) + 1 : 1
  return `${prefix}${yearStr}-${String(next).padStart(3, '0')}`
}

// ─── Due date labels ─────────────────────────────────────────────────────────

export const ECHEANCE_OPTIONS = [
  { label: 'À réception',  days: 0  },
  { label: '15 jours',     days: 15 },
  { label: '30 jours',     days: 30 },
  { label: '45 jours',     days: 45 },
  { label: '60 jours',     days: 60 },
]

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─── Status helpers ──────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:   'Brouillon',
  pending: 'En attente',
  sent:    'Envoyée',
  paid:    'Payée',
  error:   'Erreur',
  overdue: 'En retard',
}

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft:   'badge-draft',
  pending: 'badge-pending',
  sent:    'badge-sent',
  paid:    'badge-paid',
  error:   'badge-error',
  overdue: 'badge-error',
}

// ─── XSS-safe escape ─────────────────────────────────────────────────────────

export function esc(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Unique ID ───────────────────────────────────────────────────────────────

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── CSV export ──────────────────────────────────────────────────────────────

export function exportCSV(rows: string[][], filename: string) {
  const csv = rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Debounce ────────────────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
