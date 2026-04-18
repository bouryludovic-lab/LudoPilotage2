'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'
import {
  LayoutDashboard, FileText, Users, MessageSquare,
  Bot, ClipboardList, GraduationCap, Settings,
  LogOut, User, StickyNote,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',      group: 'main' },
  { href: '/factures',      icon: FileText,         label: 'Facturation',    group: 'main', badge: true },
  { href: '/clients',       icon: Users,            label: 'Clients',        group: 'main' },
  { href: '/facture-type',  icon: StickyNote,       label: 'Modèle facture', group: 'main' },
  { href: '/hub',           icon: MessageSquare,    label: 'HUB',            group: 'tools', isNew: true },
  { href: '/agent',         icon: Bot,              label: 'Agent IA',       group: 'tools', isNew: true },
  { href: '/formulaires',   icon: ClipboardList,    label: 'Formulaires',    group: 'tools' },
  { href: '/coaching',      icon: GraduationCap,    label: 'Coaching',       group: 'tools' },
  { href: '/profil',        icon: User,             label: 'Mon profil',     group: 'bottom' },
  { href: '/configuration', icon: Settings,         label: 'Configuration',  group: 'bottom' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const factures = useAppStore(s => s.factures)
  const profil   = useAppStore(s => s.profil)

  const pendingCount = factures.filter(f => f.statut === 'pending' || f.statut === 'overdue').length

  function handleLogout() {
    storage.logout()
    router.push('/login')
  }

  const mainItems   = NAV_ITEMS.filter(i => i.group === 'main')
  const toolItems   = NAV_ITEMS.filter(i => i.group === 'tools')
  const bottomItems = NAV_ITEMS.filter(i => i.group === 'bottom')

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[220px] flex flex-col z-30 select-none"
      style={{ background: '#0C1628', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white tracking-tight"
            style={{ background: '#3B6BE8', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            TNS
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white leading-tight tracking-[0.08em] uppercase">The Next Step</p>
            <p className="text-[9px] leading-tight tracking-[0.12em] uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Consulting & Strategy
            </p>
          </div>
        </div>
        {/* Blue accent line like the logo */}
        <div className="mt-4 h-px" style={{ background: 'linear-gradient(90deg, #3B6BE8, transparent)' }} />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto pb-2 space-y-0.5">
        <SectionLabel>Principal</SectionLabel>
        {mainItems.map(item => (
          <NavItem
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            badge={item.badge && pendingCount > 0 ? pendingCount : undefined}
          />
        ))}

        <SectionLabel className="mt-5">Outils IA</SectionLabel>
        {toolItems.map(item => (
          <NavItem
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            isNew={item.isNew}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {bottomItems.map(item => (
          <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        {/* User card */}
        <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: '#3B6BE8' }}>
            {(profil?.nom || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {profil?.nom || 'Mon compte'}
            </p>
          </div>
          <button onClick={handleLogout}
            className="p-1 rounded-md transition-colors"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F87171'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            title="Déconnexion">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[9px] font-bold uppercase tracking-[0.14em] px-3 pt-4 pb-1.5', className)}
      style={{ color: 'rgba(255,255,255,0.2)' }}>
      {children}
    </p>
  )
}

interface NavItemProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: { href: string; icon: React.ComponentType<any>; label: string }
  active: boolean
  badge?: number
  isNew?: boolean
}

function NavItem({ item, active, badge, isNew }: NavItemProps) {
  const Icon = item.icon
  return (
    <Link href={item.href} className={cn('nav-item', active && 'active')}>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={active ? 2.5 : 1.8} />
      <span className="flex-1 truncate">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="w-4.5 h-4.5 rounded-full text-[9px] font-bold flex items-center justify-center px-1.5"
          style={{ background: 'rgba(245,158,11,0.15)', color: '#FCD34D' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {isNew && !badge && (
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none"
          style={{ background: 'rgba(59,107,232,0.2)', color: '#7AAAFF' }}>
          NEW
        </span>
      )}
    </Link>
  )
}
