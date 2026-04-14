'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { MessageSquare, Slack, Filter, CheckCheck, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { HubMessage, HubSource, HubPriority } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const SOURCE_CONFIG: Record<HubSource, { label: string; color: string; bg: string }> = {
  circle:   { label: 'Circle',   color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  slack:    { label: 'Slack',    color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
  whatsapp: { label: 'WhatsApp', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
  email:    { label: 'Email',    color: '#FCD34D', bg: 'rgba(252,211,77,0.1)' },
  notion:   { label: 'Notion',   color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' },
}

const PRIORITY_CONFIG: Record<HubPriority, { label: string; variant: 'red' | 'amber' | 'slate' }> = {
  high:   { label: 'Urgent', variant: 'red' },
  medium: { label: 'Moyen',  variant: 'amber' },
  low:    { label: 'Faible', variant: 'slate' },
}

const DEMO: HubMessage[] = [
  { id:'1', source:'circle',   author:'Marie D.',   content:"Nouvelle question sur la formation — besoin d'une réponse urgente", date:'2026-04-14', priority:'high',   read:false, tags:['formation'], actionRequired:true },
  { id:'2', source:'slack',    author:'Team Dev',   content:'Deploy en production réussi. Tout est OK côté serveur',            date:'2026-04-14', priority:'low',    read:false, tags:['dev'] },
  { id:'3', source:'whatsapp', author:'Client A',   content:"Facture reçue, merci ! Virement fait aujourd'hui",                 date:'2026-04-13', priority:'medium', read:true,  tags:['paiement'] },
  { id:'4', source:'email',    author:'Prospect B', content:'Intéressé par votre accompagnement coaching — disponible cette semaine ?', date:'2026-04-13', priority:'high', read:false, tags:['coaching'], actionRequired:true },
  { id:'5', source:'circle',   author:'Thomas R.',  content:'Super contenu dans le module 3 ! Question sur exercice 4',         date:'2026-04-12', priority:'medium', read:true,  tags:['formation'] },
]

export default function HubPage() {
  const [filter, setFilter]     = useState<HubSource | 'all'>('all')
  const [showUnread, setShowUnread] = useState(false)
  const [messages, setMessages] = useState<HubMessage[]>(DEMO)

  const filtered = messages
    .filter(m => filter === 'all' || m.source === filter)
    .filter(m => !showUnread || !m.read)
    .sort((a, b) => {
      const ord: Record<HubPriority, number> = { high: 0, medium: 1, low: 2 }
      return ord[a.priority] - ord[b.priority] || b.date.localeCompare(a.date)
    })

  function markRead(id: string) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  }

  const unreadCount  = messages.filter(m => !m.read).length
  const urgentCount  = messages.filter(m => m.priority === 'high' && !m.read).length

  return (
    <AppLayout title="HUB" subtitle="Centralise tous tes messages importants">
      <div className="max-w-4xl space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Non lus', value: unreadCount, color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: MessageSquare },
            { label: 'Urgents', value: urgentCount, color: '#F87171', bg: 'rgba(248,113,113,0.1)', icon: AlertCircle },
            { label: 'Total',   value: messages.length, color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', icon: Clock },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
              <s.icon className="w-5 h-5 flex-shrink-0" style={{ color: s.color }} />
              <div>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'circle', 'slack', 'whatsapp', 'email'] as const).map(src => (
            <button
              key={src}
              onClick={() => setFilter(src)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filter === src ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${filter === src ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === src ? '#A78BFA' : 'rgba(255,255,255,0.5)',
              }}
            >
              {src === 'all' ? 'Tous' : SOURCE_CONFIG[src].label}
            </button>
          ))}
          <button
            onClick={() => setShowUnread(p => !p)}
            className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{
              background: showUnread ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showUnread ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: showUnread ? '#A78BFA' : 'rgba(255,255,255,0.5)',
            }}
          >
            <Filter className="w-3 h-3" /> Non lus
          </button>
        </div>

        {/* Messages */}
        {filtered.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun message" description="Connecte tes outils pour voir tes messages ici" />
        ) : (
          <div className="space-y-2">
            {filtered.map(msg => {
              const src = SOURCE_CONFIG[msg.source]
              const pri = PRIORITY_CONFIG[msg.priority]
              return (
                <div
                  key={msg.id}
                  onClick={() => markRead(msg.id)}
                  className="rounded-2xl p-4 transition-all cursor-pointer"
                  style={{
                    background: msg.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${msg.read ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: src.bg }}>
                      <MessageSquare className="w-4 h-4" style={{ color: src.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: src.color }}>{src.label}</span>
                        <span className="text-xs font-semibold text-white/70">{msg.author}</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{formatDate(msg.date)}</span>
                        <Badge variant={pri.variant} dot>{pri.label}</Badge>
                        {msg.actionRequired && <Badge variant="violet" dot>Action requise</Badge>}
                        {!msg.read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#A78BFA' }} />}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{msg.content}</p>
                    </div>
                    {!msg.read && (
                      <button
                        onClick={e => { e.stopPropagation(); markRead(msg.id) }}
                        className="p-1.5 rounded-lg hover:bg-white/8 transition-colors flex-shrink-0 mt-0.5"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                        title="Marquer comme lu"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Coming soon */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <Slack className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" />
          <div>
            <p className="text-xs font-semibold text-violet-300 mb-0.5">Connexions à venir</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Connecte Circle, Slack, WhatsApp et email via webhook Make pour centraliser tous tes messages automatiquement.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
