'use client'

import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatEur, formatDate } from '@/lib/utils'
import type { Invoice } from '@/lib/types'

interface RecentInvoicesProps {
  invoices: Invoice[]
}

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Dernières factures</h2>
          <p className="text-xs text-slate-400 mt-0.5">5 plus récentes</p>
        </div>
        <Link
          href="/factures"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Voir tout <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune facture"
          description="Créez votre première facture pour commencer."
          action={{ label: '+ Nouvelle facture', onClick: () => window.location.href = '/factures/nouvelle' }}
        />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">N°</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">Client</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200 hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">Montant</th>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">Statut</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => (
              <tr key={inv.id} className={i < invoices.length - 1 ? 'border-b border-slate-100' : ''}>
                <td className="px-4 py-3">
                  <Link href={`/factures?id=${inv.id}`} className="font-mono text-xs font-semibold text-blue-600 hover:underline">
                    {inv.num}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 truncate max-w-[140px]">
                  {inv.clientNom}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">
                  {formatDate(inv.date)}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right tabular-nums">
                  {formatEur(inv.total)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.statut} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
