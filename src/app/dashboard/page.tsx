'use client'

import { useEffect } from 'react'
import { Euro, FileText, Clock, Users } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { KPICard } from '@/components/dashboard/KPICard'
import { RecentInvoices } from '@/components/dashboard/RecentInvoices'
import { useAppStore, selectTotalCA, selectPendingAmount, selectPendingCount, selectRecentInvoices } from '@/store'
import { formatEur } from '@/lib/utils'

export default function DashboardPage() {
  const factures      = useAppStore(s => s.factures)
  const clients       = useAppStore(s => s.clients)
  const totalCA       = useAppStore(selectTotalCA)
  const pendingAmount = useAppStore(selectPendingAmount)
  const pendingCount  = useAppStore(selectPendingCount)
  const recent        = useAppStore(selectRecentInvoices(5))
  const syncing       = useAppStore(s => s.syncing)

  return (
    <AppLayout title="Tableau de bord" subtitle="Vue d'ensemble de votre activité">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="CA encaissé"
          value={formatEur(totalCA)}
          meta="factures payées"
          icon={Euro}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          label="En attente"
          value={formatEur(pendingAmount)}
          meta={`${pendingCount} facture${pendingCount !== 1 ? 's' : ''}`}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          label="Factures"
          value={String(factures.length)}
          meta="émises au total"
          icon={FileText}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
        <KPICard
          label="Clients"
          value={String(clients.length)}
          meta="actifs"
          icon={Users}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
      </div>

      {/* Recent invoices */}
      <RecentInvoices invoices={recent} />
    </AppLayout>
  )
}
