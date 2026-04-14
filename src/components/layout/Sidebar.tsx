'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'
import {
  LayoutDashboard, FileText, Users, MessageSquare,
  Bot, ClipboardList, GraduationCap, Settings,
  LogOut, Zap, User,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard',     group: 'main' },
  { href: '/factures',      icon: FileText,         label: 'Facturation',   group: 'main', badge: true },
  { href: '/clients',       icon: Users,            label: 'Clients',       group: 'main' },
  { href: '/hub',           icon: MessageSquare,    label: 'HUB',           group: 'tools', isNew: true },
  { href: '/agent',         icon: Bot,              label: 'Agent IA',      group: 'tools', isNew: true },
  { href: '/formulaires',   icon: ClipboardList,    label: 'Formulaires',   group: 'tools' },
  { href: '/coaching',      icon: GraduationCap,    label: 'Coaching',      group: 'tools' },
  { href: '/profil',        icon: User,             label: 'Mon profil',    group: 'bottom' },
  { href: '/configuration', icon: Settings,         label: 'Configuration', group: 'bottom' },
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
      style={{ background: '#0E1420', borderRight: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}
        >
          <Zap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white leading-none truncate">LudoPilotage</p>
          <p className="text-[10px] mt-0.5 leading-none font-medium" style={{ color: 'rgba(167,139,250,0.6)' }}>SaaS IA</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5 pb-2">
        <SectionLabel>Principal</SectionLabel>
        {mainItems.map(item => (
          <NavItem
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            badge={item.badge && pendingCount > 0 ? pendingCount : undefined}
          />
        ))}

        <SectionLabel className="mt-4">Outils IA</SectionLabel>
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
          <NavItem
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}

        {/* User card */}
        <div
          className="mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}
          >
            {(profil?.nom || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {profil?.nom || 'Mon compte'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#F87171'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[10px] font-bold uppercase tracking-widest px-3 pt-2 pb-1.5', className)}
      style={{ color: 'rgba(255,255,255,0.18)' }}>
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
      <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
      <span className="flex-1 truncate">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.2)', color: '#FCD34D' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {isNew && !badge && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none"
          style={{ background: 'rgba(124,58,237,0.25)', color: '#A78BFA' }}
        >
          NEW
        </span>
      )}
    </Link>
  )
}
