'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  MessageSquare, Filter, CheckCheck, AlertCircle, Clock,
  Loader2, Mail, RefreshCw, X, Reply, Send, Pencil,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { HubMessage, HubSource, HubPriority } from '@/lib/types'
import { AT_TABLES, AT_FIELDS } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { storage } from '@/lib/storage'

// ── Config ────────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface MsgDetail {
  id:             string
  threadId:       string
  gmailMessageId: string
  from:           string
  to:             string
  subject:        string
  date:           string
  body:           string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTokens() {
  return storage.getGmailTokens()
}

function getUserEmail() {
  return typeof window !== 'undefined' ? (localStorage.getItem('at_token') ?? '') : ''
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HubPage() {
  // List state
  const [filter, setFilter]         = useState<HubSource | 'all'>('all')
  const [showUnread, setShowUnread] = useState(false)
  const [messages, setMessages]     = useState<HubMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)

  // Detail panel state
  const [selectedMsg,   setSelectedMsg]   = useState<HubMessage | null>(null)
  const [msgDetail,     setMsgDetail]     = useState<MsgDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showReply,     setShowReply]     = useState(false)
  const [replyBody,     setReplyBody]     = useState('')
  const [sending,       setSending]       = useState(false)

  // Compose modal state
  const [showCompose,    setShowCompose]    = useState(false)
  const [composeTo,      setComposeTo]      = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody,    setComposeBody]    = useState('')
  const [composeSending, setComposeSending] = useState(false)

  // ── Load Airtable hub_messages on mount ──────────────────────────────────
  useEffect(() => {
    const userEmail = getUserEmail()
    const tokens = storage.getGmailTokens()
    if (tokens?.refreshToken) setGmailConnected(true)

    async function loadMessages() {
      try {
        const F = AT_FIELDS.hub_messages
        const res = await fetch('/api/airtable', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            table:         AT_TABLES.hub_messages,
            method:        'GET',
            useFieldNames: true,
            query:         userEmail
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
              tags:           (() => { try { return JSON.parse(String(f[F.tags] ?? '[]')) } catch { return [] } })(),
              actionRequired: Boolean(f[F.action_required]),
              userEmail:      String(f[F.user_email] ?? ''),
            }
          }
        )
        setMessages(atMessages)
      } catch (e) {
        console.error('[hub] Airtable load failed', e)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [])

  // ── Gmail sync ───────────────────────────────────────────────────────────
  async function syncGmail() {
    const tokens = getTokens()
    if (!tokens) return

    setSyncing(true)
    try {
      const res = await fetch('/api/gmail/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
          userEmail:    getUserEmail(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          storage.clearGmailTokens()
          setGmailConnected(false)
          toast.error('Session Gmail expirée — reconnectez dans Configuration')
        } else {
          toast.error(data.error ?? 'Erreur synchronisation Gmail')
        }
        return
      }

      if (data.newAccessToken) {
        storage.setGmailTokens({ ...tokens, accessToken: data.newAccessToken, expiresAt: data.newExpiresAt })
      }

      const gmailMessages: HubMessage[] = data.messages ?? []
      setMessages(prev => [...prev.filter(m => !m.id.startsWith('gmail_')), ...gmailMessages])
      toast.success(`${gmailMessages.length} email${gmailMessages.length !== 1 ? 's' : ''} synchronisé${gmailMessages.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Erreur réseau lors de la synchronisation Gmail')
    } finally {
      setSyncing(false)
    }
  }

  // ── Open message (fetches full body for Gmail messages) ───────────────────
  async function openMessage(msg: HubMessage) {
    markRead(msg.id)
    setSelectedMsg(msg)
    setMsgDetail(null)
    setShowReply(false)
    setReplyBody('')

    if (!msg.id.startsWith('gmail_')) return

    const tokens = getTokens()
    if (!tokens) return

    setLoadingDetail(true)
    try {
      const res = await fetch('/api/gmail/message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          gmailId:      msg.id.replace('gmail_', ''),
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsgDetail(data.message)
        if (data.newAccessToken) {
          storage.setGmailTokens({ ...tokens, accessToken: data.newAccessToken, expiresAt: data.newExpiresAt })
        }
        // Mark as read in list
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
      } else {
        toast.error(data.error ?? 'Impossible de charger le message')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Send reply ────────────────────────────────────────────────────────────
  async function sendReply() {
    if (!msgDetail || !replyBody.trim()) return
    const tokens = getTokens()
    if (!tokens) return

    setSending(true)
    try {
      const subject = msgDetail.subject.startsWith('Re: ')
        ? msgDetail.subject
        : `Re: ${msgDetail.subject}`

      const res = await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:           msgDetail.from,
          subject,
          body:         replyBody,
          threadId:     msgDetail.threadId,
          inReplyTo:    msgDetail.gmailMessageId,
          references:   msgDetail.gmailMessageId,
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.newAccessToken) {
          storage.setGmailTokens({ ...tokens, accessToken: data.newAccessToken, expiresAt: data.newExpiresAt })
        }
        toast.success('Réponse envoyée !')
        setShowReply(false)
        setReplyBody('')
      } else {
        toast.error(data.error ?? 'Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  // ── Send new email ────────────────────────────────────────────────────────
  async function sendNewEmail() {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error('Remplis tous les champs')
      return
    }
    const tokens = getTokens()
    if (!tokens) return

    setComposeSending(true)
    try {
      const res = await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:           composeTo,
          subject:      composeSubject,
          body:         composeBody,
          accessToken:  tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt:    tokens.expiresAt,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.newAccessToken) {
          storage.setGmailTokens({ ...tokens, accessToken: data.newAccessToken, expiresAt: data.newExpiresAt })
        }
        toast.success('Email envoyé !')
        setShowCompose(false)
        setComposeTo('')
        setComposeSubject('')
        setComposeBody('')
      } else {
        toast.error(data.error ?? 'Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setComposeSending(false)
    }
  }

  // ── Mark local read ───────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout title="HUB" subtitle="Centralise tous tes messages importants">
      <div className="max-w-4xl space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Non lus', value: unreadCount,     color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: MessageSquare },
            { label: 'Urgents', value: urgentCount,     color: '#F87171', bg: 'rgba(248,113,113,0.1)', icon: AlertCircle },
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

        {/* Filters + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'circle', 'slack', 'whatsapp', 'email'] as const).map(src => (
            <button key={src} onClick={() => setFilter(src)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filter === src ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${filter === src ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === src ? '#A78BFA' : 'rgba(255,255,255,0.5)',
              }}>
              {src === 'all' ? 'Tous' : SOURCE_CONFIG[src].label}
            </button>
          ))}

          {gmailConnected && (
            <>
              <button onClick={syncGmail} disabled={syncing}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)',
                  color: syncing ? 'rgba(255,255,255,0.3)' : '#FCD34D' }}>
                {syncing ? <><Loader2 className="w-3 h-3 animate-spin" /> Sync...</> : <><Mail className="w-3 h-3" /> Sync Gmail</>}
              </button>
              <button onClick={() => setShowCompose(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', color: '#A78BFA' }}>
                <Pencil className="w-3 h-3" /> Nouveau mail
              </button>
            </>
          )}

          <button onClick={() => setShowUnread(p => !p)}
            className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{
              background: showUnread ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showUnread ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: showUnread ? '#A78BFA' : 'rgba(255,255,255,0.5)',
            }}>
            <Filter className="w-3 h-3" /> Non lus
          </button>
        </div>

        {/* Message list */}
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
              const isSelected = selectedMsg?.id === msg.id
              return (
                <div key={msg.id} onClick={() => openMessage(msg)}
                  className="rounded-2xl p-4 transition-all cursor-pointer"
                  style={{
                    background: isSelected
                      ? 'rgba(124,58,237,0.12)'
                      : msg.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? 'rgba(124,58,237,0.3)' : msg.read ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'}`,
                  }}>
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
                      <p className="text-sm leading-relaxed truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>
                        {msg.content}
                      </p>
                    </div>
                    {!msg.read && (
                      <button onClick={e => { e.stopPropagation(); markRead(msg.id) }}
                        className="p-1.5 rounded-lg hover:bg-white/8 transition-colors flex-shrink-0 mt-0.5"
                        style={{ color: 'rgba(255,255,255,0.25)' }} title="Marquer comme lu">
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Connect Gmail CTA */}
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
            <button onClick={() => { window.location.href = '/api/auth/gmail' }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
              style={{ background: 'rgba(252,211,77,0.15)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.25)' }}>
              <RefreshCw className="w-3 h-3" /> Connecter
            </button>
          </div>
        )}

      </div>

      {/* ── Detail panel (slide-over from right) ─────────────────────────── */}
      {selectedMsg && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => { setSelectedMsg(null); setMsgDetail(null) }} />

          {/* Panel */}
          <div className="w-full max-w-lg h-full overflow-y-auto flex flex-col"
            style={{ background: '#0e0c1a', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 p-4 sticky top-0 z-10"
              style={{ background: '#0e0c1a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{selectedMsg.author}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {msgDetail?.date ? new Date(msgDetail.date).toLocaleString('fr-FR') : formatDate(selectedMsg.date)}
                </p>
              </div>
              <button onClick={() => { setSelectedMsg(null); setMsgDetail(null) }}
                className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subject */}
            <div className="px-4 pt-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-sm font-bold text-white leading-snug">
                {msgDetail?.subject || selectedMsg.content}
              </p>
              {msgDetail?.from && (
                <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  De : {msgDetail.from}
                </p>
              )}
              {msgDetail?.to && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  À : {msgDetail.to}
                </p>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 px-4 py-4">
              {loadingDetail ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                </div>
              ) : msgDetail?.body ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {msgDetail.body}
                </p>
              ) : !selectedMsg.id.startsWith('gmail_') ? (
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {selectedMsg.content}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Corps du message non disponible
                </p>
              )}
            </div>

            {/* Reply section — only for Gmail messages */}
            {selectedMsg.id.startsWith('gmail_') && (
              <div className="p-4 sticky bottom-0"
                style={{ background: '#0e0c1a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {!showReply ? (
                  <button onClick={() => setShowReply(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'rgba(124,58,237,0.12)', color: '#A78BFA', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <Reply className="w-3.5 h-3.5" /> Répondre
                  </button>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={replyBody}
                      onChange={e => setReplyBody(e.target.value)}
                      placeholder="Votre réponse..."
                      rows={5}
                      autoFocus
                      className="w-full text-sm px-3 py-2.5 rounded-xl resize-none outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                    />
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setShowReply(false); setReplyBody('') }}
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Annuler
                      </button>
                      <button onClick={sendReply}
                        disabled={sending || !replyBody.trim()}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: sending || !replyBody.trim() ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.2)',
                          color: sending || !replyBody.trim() ? 'rgba(167,139,250,0.35)' : '#A78BFA',
                          border: '1px solid rgba(124,58,237,0.25)',
                        }}>
                        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Envoyer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compose modal ─────────────────────────────────────────────────── */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCompose(false)} />
          <div className="relative w-full max-w-lg rounded-2xl p-6 space-y-4"
            style={{ background: '#0e0c1a', border: '1px solid rgba(255,255,255,0.1)' }}>

            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white">Nouveau mail</h3>
              <button onClick={() => setShowCompose(false)}
                className="p-1 rounded-lg hover:bg-white/8"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <input value={composeTo} onChange={e => setComposeTo(e.target.value)}
              placeholder="À : email@exemple.com" autoFocus
              className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />

            <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
              placeholder="Objet"
              className="w-full text-sm px-3 py-2.5 rounded-xl outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />

            <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)}
              placeholder="Message..." rows={7}
              className="w-full text-sm px-3 py-2.5 rounded-xl resize-none outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }} />

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowCompose(false)} className="text-xs px-3 py-2 rounded-xl"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Annuler
              </button>
              <button onClick={sendNewEmail}
                disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-semibold transition-all"
                style={{
                  background: composeSending ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.2)',
                  color: composeSending ? 'rgba(167,139,250,0.35)' : '#A78BFA',
                  border: '1px solid rgba(124,58,237,0.3)',
                }}>
                {composeSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
