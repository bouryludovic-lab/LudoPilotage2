import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/types'

// ─── Generic Badge ────────────────────────────────────────────────────────────

type BadgeVariant = 'violet' | 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'indigo'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  violet: 'badge-violet',
  green:  'badge-green',
  amber:  'badge-amber',
  red:    'badge-red',
  blue:   'badge-blue',
  slate:  'badge-slate',
  indigo: 'bg-indigo-500/15 text-indigo-300',
}

export function Badge({ variant = 'slate', children, className, dot }: BadgeProps) {
  return (
    <span className={cn('badge', BADGE_VARIANTS[variant], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

// ─── Status Badge (Invoice) ───────────────────────────────────────────────────

const STATUS_VARIANTS: Record<InvoiceStatus, string> = {
  draft:   'badge-slate',
  pending: 'badge-amber',
  sent:    'badge-blue',
  paid:    'badge-green',
  error:   'badge-red',
  overdue: 'badge-red',
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:   'Brouillon',
  pending: 'En attente',
  sent:    'Envoyée',
  paid:    'Payée',
  error:   'Erreur',
  overdue: 'En retard',
}

interface StatusBadgeProps {
  status: InvoiceStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('badge', STATUS_VARIANTS[status], className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status]}
    </span>
  )
}
