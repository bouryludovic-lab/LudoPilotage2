'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Users, Plus, User, Database,
  Settings, HelpCircle, X, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const NAV_MAIN = [
  { href: '/dashboard',     label: 'Tableau de bord',    icon: LayoutDashboard },
  { href: '/factures',      label: 'Factures',           icon: FileText,        badge: 'pending' },
  { href: '/clients',       label: 'Clients',            icon: Users },
  { href: '/factures/nouvelle', label: '+ Nouvelle facture', icon: Plus },
]

const NAV_SETTINGS = [
  { href: '/profil',        label: 'Mon profil',         icon: User },
  { href: '/configuration', label: 'Configuration',      icon: Settings },
]

const NAV_COACHING = [
  { href: '/coaching',      label: 'Questions élèves',   icon: MessageSquare },
  { href: '/howto',         label: 'How to use',         icon: HelpCircle },
]

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname  = usePathname()
  const factures  = useAppStore(s => s.factures)
  const profil    = useAppStore(s => s.profil)

  const pendingCount = factures.filter(f => f.statut === 'pending' || f.statut === 'sent').length
  const initials = profil.nom
    ? profil.nom.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed md:static inset-y-0 left-0 z-50 w-60 bg-slate-900 flex flex-col transition-transform duration-250',
        'md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/[0.07]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-white leading-tight tracking-wide">THE NEXT STEP</div>
                <div className="text-[9px] text-white/40 tracking-[1.5px] mt-0.5">CONSULTING & STRATEGY</div>
              </div>
            </div>
            <button onClick={onClose} className="md:hidden text-slate-500 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_MAIN.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/factures/nouvelle')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-normal transition-all duration-150',
                  active
                    ? 'bg-blue-500/15 text-blue-200'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                  active ? 'bg-blue-500' : 'bg-slate-600',
                )} />
                <span className="flex-1">{item.label}</span>
                {item.badge === 'pending' && pendingCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )
          })}

          <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.8px]">
            Paramètres
          </div>
          {NAV_SETTINGS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150',
                  active
                    ? 'bg-blue-500/15 text-blue-200'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', active ? 'bg-blue-500' : 'bg-slate-600')} />
                {item.label}
              </Link>
            )
          })}

          <div className="pt-3 pb-1 px-2 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.8px]">
            Coaching
          </div>
          {NAV_COACHING.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-150',
                  active
                    ? 'bg-blue-500/15 text-blue-200'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200',
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', active ? 'bg-blue-500' : 'bg-slate-600')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.07] p-2">
          <Link
            href="/profil"
            onClick={onClose}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-slate-300 truncate">
                {profil.nom || 'Mon profil'}
              </div>
              <div className="text-[11px] text-slate-600">Auto-entrepreneur</div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  )
}
