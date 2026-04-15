'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { MessageSquare, Filter, CheckCheck, AlertCircle, Clock, Loader2, Mail, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { HubMessage, HubSource, HubPriority } from '@/lib/types'
import { AT_TABLES, AT_FIELDS } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { storage } from '@/lib/storage'

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

export default function HubPage() {
  const [filter, setFilter]         = useState<HubSource | 'all'>('all')
  const [showUnread, setShowUnread] = useState(false)
  const [messages, setMessages]     = useState<HubMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)

  // ── Load Airtable hub_messages on mount ────────────────────────────────────
  useEffect(() => {
    const userEmail = typeof window !== 'undefined'
      ? (localStorage.getItem('at_token') ?? '')
      : ''

    // Check if Gmail is connected
    const tokens = storage.getGmailTokens()
    if (tokens?.refreshToken) setGmailConnected(true)

    async function loadMessages() {
      try {
        const F = AT_FIELDS.hub_messages
        const res = await fetch('/api/airtable', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            table:          AT_TABLES.hub_messages,
            method:         'GET',
            useFieldNames:  true,
            query:          userEmail
              ? `filterByFormula=${encodeURIComponent(`{${F.user_email}}="${userEmail}"`)}&sort[0][field]=date&sort[0][direction]=desc`
              : undefined,
          }),
        })

        if (!res.ok) throw new Error(`Airtable ${res.status}`)
        const data = await res.json()

        const atMessages: HubMessage[] = (data.records ?? []).map(
          (rec: { id: string; fields: Record<string, unknown> }) => {
            const f = rec.fields
            return {
              id:             rec.id,
              source:         (String(f[F.source] ?? 'email')) as HubSource,
              author:         String(f[F.author]  ?? ''),
              content:        String(f[F.content] ?? ''),
              date:           String(f[F.date]    ?? ''),
              priority:       (String(f[F.priority] ?? 'medium')) as HubPriority,
              read:           Boolean(f[F.read]),
              tags:           (() => {
                try { return JSON.parse(String(f[F.tags] ?? '[]')) } catch { return [] }
              })(),
              actionRequired: Boolean(f[F.action_required]),
              userEmail:      String(f[F.user_email] ?? ''),
            }
          }
        )

        setMessages(atMessages)
      } catch (e) {
        console.error('[hub] Airtable load failed', e)
        // Silently fall back to empty — don't crash the page
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [])

  // ── Gmail sync ─────────────────────────────────────────────────────────────
  async function syncGmail() {
    const tokens = storage.getGmailTokens()
    if (!tokens) return

    const userEmail = typeof window !== 'undefined'
      ? (localStorage.getItem('at_token') ?? '')
      : ''

    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
          userEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          storage.clearGmailTokens()
          setGmailConnected(false)
          toast.error('Session Gmail expirée — reconnectez Gmail dans la Configuration')
        } else {
          toast.error(data.error ?? 'Erreur synchronisation Gmail')
        }
        return
      }

      // Update tokens in localStorage if server refreshed them
      if (data.newAccessToken) {
        storage.setGmailTokens({
          ...tokens,
          accessToken: data.newAccessToken,
          expiresAt:   data.newExpiresAt,
        })
      }

      const gmailMessages: HubMessage[] = data.messages ?? []

      // Merge: replace old gmail_* messages with fresh ones
      setMessages(prev => {
        const nonGmail = prev.filter(m => !m.id.startsWith('gmail_'))
        return [...nonGmail, ...gmailMessages]
      })

      toast.success(`${gmailMessages.length} email${gmailMessages.length !== 1 ? 's' : ''} Gmail synchronisé${gmailMessages.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Erreur réseau lors de la synchronisation Gmail')
    } finally {
      setSyncing(false)
    }
  }

  // ── Mark read ──────────────────────────────────────────────────────────────
  function markRead(id: string) {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  }

  const filtered = messages
    .filter(m => filter === 'all' || m.source === filter)
    .filter(m => !showUnread || !m.read)
    .sort((a, b) => {
      const ord: Record<HubPriority, number> = { high: 0, medium: 1, low: 2 }
      return ord[a.priority] - ord[b.priority] || b.date.localeCompare(a.date)
    })

  const unreadCount = messages.filter(m => !m.read).length
  const urgentCount = messages.filter(m => m.priority === 'high' && !m.read).length

  return (
    <AppLayout title="HUB" subtitle="Centralise tous tes messages importants">
      <div className="max-w-4xl space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Non lus', value: unreadCount,      color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: MessageSquare },
            { label: 'Urgents', value: urgentCount,      color: '#F87171', bg: 'rgba(248,113,113,0.1)', icon: AlertCircle },
            { label: 'Total',   value: messages.length,  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', icon: Clock },
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

        {/* Filters + Gmail sync */}
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

          {/* Gmail sync button — only shown when connected */}
          {gmailConnected && (
            <button
              onClick={syncGmail}
              disabled={syncing}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              style={{
                background: 'rgba(252,211,77,0.08)',
                border:     '1px solid rgba(252,211,77,0.2)',
                color:      syncing ? 'rgba(255,255,255,0.3)' : '#FCD34D',
              }}
            >
              {syncing
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Sync...</>
                : <><Mail className="w-3 h-3" /> Sync Gmail</>
              }
            </button>
          )}

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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun message"
            description="Connecte tes outils pour voir tes messages ici" />
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

        {/* Connect Gmail CTA — only shown when not connected */}
        {!gmailConnected && (
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(252,211,77,0.06)', border: '1px solid rgba(252,211,77,0.12)' }}>
            <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#FCD34D' }} />
            <div className="flex-1">
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#FCD34D' }}>Connecte Gmail</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Synchronise tes emails non lus directement dans le Hub.
                Configure la connexion dans{' '}
                <a href="/configuration" className="underline" style={{ color: '#FCD34D' }}>Configuration</a>.
              </p>
            </div>
            <button
              onClick={() => { window.location.href = '/api/auth/gmail' }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(252,211,77,0.15)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' }}
            >
              <RefreshCw className="w-3 h-3" /> Connecter
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  )
}
