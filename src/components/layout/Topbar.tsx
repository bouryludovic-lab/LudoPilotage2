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
      className="h-[60px] flex items-center justify-between px-6 sticky top-0 z-20"
      style={{
        background: 'rgba(12,22,40,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div>
        <h1 className="text-[15px] font-bold text-white/90 leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={sync}
          disabled={syncing}
          title="Synchroniser"
          className={cn(
            'p-2 rounded-xl transition-colors',
            syncing ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/6',
          )}
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
        </button>

        {actions}

        <Link
          href="/factures/nouvelle"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold rounded-xl transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #3B6BE8, #2563EB)', color: 'white' }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">Nouvelle facture</span>
        </Link>
      </div>
    </header>
  )
}
