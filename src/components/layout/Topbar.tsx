'use client'

import { Menu, RefreshCw, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSync } from '@/hooks/useSync'

interface TopbarProps {
  title: string
  subtitle?: string
  onMenuClick: () => void
  actions?: React.ReactNode
}

export function Topbar({ title, subtitle, onMenuClick, actions }: TopbarProps) {
  const { sync, syncing } = useSync()

  return (
    <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={sync}
          disabled={syncing}
          title="Synchroniser avec Airtable"
          className={cn(
            'p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors',
            syncing && 'opacity-50 cursor-not-allowed',
          )}
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
        </button>

        {actions}

        <Link
          href="/factures/nouvelle"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-[13px] font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nouvelle facture</span>
        </Link>
      </div>
    </header>
  )
}
