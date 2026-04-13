import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/types'

const VARIANTS = {
  draft:   'bg-slate-100 text-slate-500',
  pending: 'bg-amber-50 text-amber-700',
  sent:    'bg-blue-50 text-blue-700',
  paid:    'bg-green-50 text-green-700',
  error:   'bg-red-50 text-red-700',
  overdue: 'bg-red-50 text-red-700',
} satisfies Record<InvoiceStatus, string>

const DOT_COLORS = {
  draft:   'bg-slate-400',
  pending: 'bg-amber-500',
  sent:    'bg-blue-500',
  paid:    'bg-green-500',
  error:   'bg-red-500',
  overdue: 'bg-red-500',
} satisfies Record<InvoiceStatus, string>

const LABELS: Record<InvoiceStatus, string> = {
  draft:   'Brouillon',
  pending: 'En attente',
  sent:    'Envoyée',
  paid:    'Payée',
  error:   'Erreur',
  overdue: 'En retard',
}

interface BadgeProps {
  status: InvoiceStatus
  className?: string
}

export function StatusBadge({ status, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold',
      VARIANTS[status],
      className,
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', DOT_COLORS[status])} />
      {LABELS[status]}
    </span>
  )
}
