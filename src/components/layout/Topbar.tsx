'use client'

import { RefreshCw, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSync } from '@/hooks/useSync'

interface TopbarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { sync, syncing } = useSync()

  return (
    <header
      className="h-[58px] flex items-center justify-between px-6 sticky top-0 z-20"
      style={{
        background: '#0C1628',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div>
        {subtitle && (
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] mb-0.5"
            style={{ color: 'rgba(255,255,255,0.28)' }}>
            {subtitle}
          </p>
        )}
        <h1 className="text-[15px] font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={sync}
          disabled={syncing}
          title="Synchroniser"
          className={cn(
            'p-2 rounded-lg transition-colors',
            syncing ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5',
          )}
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
        </button>

        {actions}

        <Link
          href="/factures/nouvelle"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-all active:scale-95 hover:opacity-90"
          style={{ background: '#3B6BE8', color: 'white' }}
        >
          <Plus className="w-3 h-3" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nouvelle facture</span>
        </Link>
      </div>
    </header>
  )
}
