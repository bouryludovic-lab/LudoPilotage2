import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' }

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin text-violet-400', SIZES[size], className)} />
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: 'rgba(8,11,20,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-white/40 font-medium">Chargement…</p>
      </div>
    </div>
  )
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="skeleton h-4" style={{ width: `${55 + (i * 11) % 35}%` }} />
        </td>
      ))}
    </tr>
  )
}
