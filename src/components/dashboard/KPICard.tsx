import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  label: string
  value: string
  meta?: string
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  trend?: { value: string; positive: boolean }
}

export function KPICard({ label, value, meta, icon: Icon, iconBg = 'bg-blue-50', iconColor = 'text-blue-600', trend }: KPICardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</div>
      {meta && <div className="text-[11px] text-slate-400 mt-1">{meta}</div>}
      {trend && (
        <div className={cn('text-[11px] font-medium mt-2', trend.positive ? 'text-green-600' : 'text-red-500')}>
          {trend.positive ? '▲' : '▼'} {trend.value}
        </div>
      )}
    </div>
  )
}
