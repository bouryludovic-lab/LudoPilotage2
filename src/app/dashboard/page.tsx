'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAppStore } from '@/store'
import { useSync } from '@/hooks/useSync'
import { Euro, FileText, Clock, Users, TrendingUp, ArrowUpRight, Zap, MessageSquare, Bot, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { formatMontant, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'

export default function DashboardPage() {
  const { factures, clients, profil } = useAppStore()
  const { sync, syncing } = useSync()

  useEffect(() => { sync() }, [])

  const totalCA     = factures.filter(f => f.statut === 'paid').reduce((s, f) => s + f.total, 0)
  const pending     = factures.filter(f => f.statut === 'pending' || f.statut === 'sent')
  const pendingAmt  = pending.reduce((s, f) => s + f.total, 0)
  const overdue     = factures.filter(f => f.statut === 'overdue')
  const recentInv   = [...factures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const KPIs = [
    {
      label: 'CA Encaissé',
      value: formatMontant(totalCA),
      icon: Euro,
      color: '#4ADE80',
      bg: 'rgba(74,222,128,0.1)',
      border: 'rgba(74,222,128,0.15)',
      sub: `${factures.filter(f => f.statut === 'paid').length} factures payées`,
    },
    {
      label: 'En attente',
      value: formatMontant(pendingAmt),
      icon: Clock,
      color: '#FCD34D',
      bg: 'rgba(252,211,77,0.1)',
      border: 'rgba(252,211,77,0.15)',
      sub: `${pending.length} factures`,
    },
    {
      label: 'En retard',
      value: overdue.length > 0 ? formatMontant(overdue.reduce((s, f) => s + f.total, 0)) : '—',
      icon: TrendingUp,
      color: overdue.length > 0 ? '#F87171' : 'rgba(255,255,255,0.3)',
      bg: overdue.length > 0 ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)',
      border: overdue.length > 0 ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)',
      sub: `${overdue.length} facture${overdue.length !== 1 ? 's' : ''}`,
    },
    {
      label: 'Clients',
      value: clients.length.toString(),
      icon: Users,
      color: '#7AAAFF',
      bg: 'rgba(122,170,255,0.1)',
      border: 'rgba(122,170,255,0.12)',
      sub: 'actifs',
    },
  ]

  const MODULES = [
    { href: '/hub',       icon: MessageSquare, label: 'HUB',       desc: 'Centralise tes messages', color: '#60A5FA', isNew: true },
    { href: '/agent',     icon: Bot,           label: 'Agent IA',  desc: 'Crée des agents IA',       color: '#7AAAFF', isNew: true },
    { href: '/coaching',  icon: GraduationCap, label: 'Coaching',  desc: 'Suivi des élèves',         color: '#34D399' },
  ]

  return (
    <AppLayout title="Dashboard" subtitle={`${greeting}, ${profil?.nom?.split(' ')[0] || 'vous'}`}>
      <div className="space-y-6 max-w-6xl">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIs.map(kpi => (
            <div
              key={kpi.label}
              className="rounded-2xl p-5"
              style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {kpi.label}
                </p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold mb-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recent invoices */}
          <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white/80">Factures récentes</h2>
              <Link href="/factures" className="text-xs font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1">
                Voir tout <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            {recentInv.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <FileText className="w-8 h-8 mb-2" style={{ color: 'rgba(255,255,255,0.15)' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Aucune facture</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInv.map(inv => (
                  <Link
                    key={inv.id}
                    href="/factures"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/4"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(59,107,232,0.12)' }}>
                      <FileText className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80 truncate">{inv.clientNom || '—'}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{inv.num} · {formatDate(inv.date)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-white/80">{formatMontant(inv.total)}</p>
                      <StatusBadge status={inv.statut} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Modules rapides */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-bold text-white/80 mb-4">Modules IA</h2>
            <div className="space-y-2.5">
              {MODULES.map(m => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all hover:bg-white/4 group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${m.color}18`, border: `1px solid ${m.color}25` }}>
                    <m.icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-white/75">{m.label}</p>
                      {m.isNew && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(59,107,232,0.18)', color: '#7AAAFF' }}>NEW</span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{m.desc}</p>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'rgba(255,255,255,0.5)' }} />
                </Link>
              ))}
            </div>

            {/* Quick new invoice */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Link
                href="/factures/nouvelle"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #3B6BE8, #2563EB)' }}
              >
                <Zap className="w-3.5 h-3.5" strokeWidth={2.5} />
                Nouvelle facture
              </Link>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  )
}
