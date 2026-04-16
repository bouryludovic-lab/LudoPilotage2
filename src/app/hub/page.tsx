'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  MessageSquare, Filter, CheckCheck, AlertCircle, Clock,
  Loader2, Mail, RefreshCw, X, Reply, Send, Pencil, Paperclip,
  Settings, Sparkles, ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { HubMessage, HubSource, HubPriority, MessageCategory, TriageResult, TriageConfig } from '@/lib/types'
import { AT_TABLES, AT_FIELDS, DEFAULT_TRIAGE_CONFIG } from '@/lib/types'
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

const CATEGORY_CONFIG: Record<MessageCategory, { label: string; color: string; bg: string }> = {
  perso:       { label: 'Perso',        color: '#C084FC', bg: 'rgba(192,132,252,0.1)' },
  pro_admin:   { label: 'Pro · Admin',  color: '#60A5FA', bg: 'rgba(96,165,250,0.1)'  },
  pro_outils:  { label: 'Pro · Outils', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)'  },
  pro_promos:  { label: 'Pro · Promos', color: '#FB923C', bg: 'rgba(251,146,60,0.1)'  },
  pubs:        { label: 'Pubs',         color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  newsletters: { label: 'Newsletter',   color: '#4ADE80', bg: 'rgba(74,222,128,0.1)'  },
  spam:        { label: 'Spam',         color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
}

const CAT_FILTERS = [
  { id: 'all',         label: 'Toutes' },
  { id: 'perso',       label: 'Perso' },
  { id: 'pro',         label: 'Pro' },
  { id: 'pubs',        label: 'Pubs' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'spam',        label: 'Spam' },
] as const
type CatFilter = typeof CAT_FILTERS[number]['id']

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttachmentItem {
  name:   string
  type:   string
  base64: string
}

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

function getEffectivePriority(msg: HubMessage, results: Record<string, TriageResult>): HubPriority {
  const base = results[msg.id]?.priority ?? msg.priority
  if (base === 'medium' && !msg.read) {
    const days = (Date.now() - new Date(msg.date).getTime()) / 86_400_000
    if (days >= 4) return 'high'
  }
  return base
}

function getMsgCategory(msg: HubMessage, results: Record<string, TriageResult>): MessageCategory | undefined {
  return results[msg.id]?.category ?? msg.category
}

function readFilesAsBase64(
  files: FileList | null,
  setter: React.Dispatch<React.SetStateAction<AttachmentItem[]>>
) {
  if (!files) return
  Array.from(files).forEach(file => {
    if (file.size > 4 * 1024 * 1024) {
      // Warn but don't import toast here — use a simple alert instead;
      // the component will handle this inline
      console.warn(`${file.name} too large`)
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      const base64  = dataUrl.split(',')[1] ?? ''
      setter(prev => [...prev, { name: file.name, type: file.type || 'application/octet-stream', base64 }])
    }
    reader.readAsDataURL(file)
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HubPage() {
  // List state
  const [filter, setFilter]         = useState<HubSource | 'all'>('all')
  const [catFilter, setCatFilter]   = useState<CatFilter>('all')
  const [showUnread, setShowUnread] = useState(false)
  const [messages, setMessages]     = useState<HubMessage[]>([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)

  // Triage state
  const [triageResults,    setTriageResults]    = useState<Record<string, TriageResult>>({})
  const [triageConfig,     setTriageConfigState] = useState<TriageConfig>(DEFAULT_TRIAGE_CONFIG)
  const [triaging,         setTriaging]         = useState(false)
  const [showTriageConfig, setShowTriageConfig] = useState(false)
  const [editingConfig,    setEditingConfig]    = useState<TriageConfig>(DEFAULT_TRIAGE_CONFIG)

  // Detail panel state
  const [selectedMsg,   setSelectedMsg]   = useState<HubMessage | null>(null)
  const [msgDetail,     setMsgDetail]     = useState<MsgDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showReply,     setShowReply]     = useState(false)
  const [replyBody,     setReplyBody]     = useState('')
  const [sending,       setSending]       = useState(false)

  // Compose modal state
  const [showCompose,       setShowCompose]       = useState(false)
  const [composeTo,         setComposeTo]         = useState('')
  const [composeSubject,    setComposeSubject]    = useState('')
  const [composeBody,       setComposeBody]       = useState('')
  const [composeSending,    setComposeSending]    = useState(false)
  const [composeAttachments, setComposeAttachments] = useState<AttachmentItem[]>([])
  const [replyAttachments,   setReplyAttachments]   = useState<AttachmentItem[]>([])

  // File input refs (hidden)
  const composeFileRef = useRef<HTMLInputElement>(null)
  const replyFileRef   = useRef<HTMLInputElement>(null)

  // ── Load Airtable hub_messages on mount ──────────────────────────────────
  useEffect(() => {
    const userEmail = getUserEmail()
    const tokens = storage.getGmailTokens()
    if (tokens?.refreshToken) setGmailConnected(true)

    const storedResults = storage.getTriageResults()
    setTriageResults(storedResults)
    const storedConfig = storage.getTriageConfig()
    setTriageConfigState(storedConfig)
    setEditingConfig(storedConfig)

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

  // ── AI triage ────────────────────────────────────────────────────────────
  async function runTriage(msgs: HubMessage[], config: TriageConfig) {
    const toTriage = msgs.filter(m => m.id.startsWith('gmail_'))
    if (!toTriage.length) return
    setTriaging(true)
    try {
      const res = await fetch('/api/gmail/triage', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: toTriage.map(m => ({
            id:          m.id,
            from:        m.author,
            subject:     m.content,
            date:        m.date,
            isImportant: m.priority === 'high',
          })),
          config,
        }),
      })
      const data = await res.json()
      if (res.ok && data.results?.length) {
        setTriageResults(prev => {
          const updated = { ...prev }
          for (const r of data.results) {
            updated[r.id] = { category: r.category, priority: r.priority, classifiedAt: new Date().toISOString() }
          }
          storage.setTriageResults(updated)
          return updated
        })
        toast.success(`${data.results.length} email${data.results.length !== 1 ? 's' : ''} classé${data.results.length !== 1 ? 's' : ''} par IA`)
      }
    } catch {
      toast.error('Erreur lors du triage IA')
    } finally {
      setTriaging(false)
    }
  }

  // ── Save triage config ────────────────────────────────────────────────────
  function saveTriageConfig() {
    storage.setTriageConfig(editingConfig)
    setTriageConfigState(editingConfig)
    setShowTriageConfig(false)
    toast.success('Configuration sauvegardée')
  }

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
      if (gmailMessages.length > 0) runTriage(gmailMessages, triageConfig)
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
    setReplyAttachments([])

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
          attachments:  replyAttachments,
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
        setReplyAttachments([])
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
          to:          composeTo,
          subject:     composeSubject,
          body:        composeBody,
          attachments: composeAttachments,
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
        setComposeAttachments([])
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
    .filter(m => {
      if (catFilter === 'all') return true
      const cat = getMsgCategory(m, triageResults)
      if (!cat) return false
      if (catFilter === 'pro') return cat.startsWith('pro_')
      return cat === catFilter
    })
    .filter(m => !showUnread || !m.read)
    .sort((a, b) => {
      const ord: Record<HubPriority, number> = { high: 0, medium: 1, low: 2 }
      return ord[getEffectivePriority(a, triageResults)] - ord[getEffectivePriority(b, triageResults)]
        || b.date.localeCompare(a.date)
    })

  const unreadCount = messages.filter(m => !m.read).length
  const urgentCount = messages.filter(m => getEffectivePriority(m, triageResults) === 'high' && !m.read).length

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

        {/* Category filters + triage controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {CAT_FILTERS.map(f => (
            <button key={f.id} onClick={() => setCatFilter(f.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: catFilter === f.id ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${catFilter === f.id ? 'rgba(251,146,60,0.35)' : 'rgba(255,255,255,0.07)'}`,
                color: catFilter === f.id ? '#FB923C' : 'rgba(255,255,255,0.4)',
              }}>
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            {triaging && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Loader2 className="w-3 h-3 animate-spin" /> Triage...
              </span>
            )}
            {gmailConnected && (
              <button
                onClick={() => runTriage(messages.filter(m => m.id.startsWith('gmail_')), triageConfig)}
                disabled={triaging}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: triaging ? 'rgba(255,255,255,0.03)' : 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  color: triaging ? 'rgba(255,255,255,0.25)' : '#8B5CF6',
                }}>
                <Sparkles className="w-3 h-3" /> Trier par IA
              </button>
            )}
            <button onClick={() => setShowTriageConfig(p => !p)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition-all"
              style={{
                background: showTriageConfig ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)',
              }}>
              <Settings className="w-3 h-3" />
              <ChevronDown className="w-3 h-3" style={{ transform: showTriageConfig ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          </div>
        </div>

        {/* Triage config panel */}
        {showTriageConfig && (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <p className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>
              Configuration du triage IA — Décris chaque catégorie pour affiner la classification
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(editingConfig) as Array<keyof TriageConfig>).map(key => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: CATEGORY_CONFIG[key as MessageCategory].color }}>
                    {CATEGORY_CONFIG[key as MessageCategory].label}
                  </label>
                  <textarea
                    value={editingConfig[key]}
                    onChange={e => setEditingConfig(prev => ({ ...prev, [key]: e.target.value }))}
                    rows={2}
                    className="w-full text-xs px-2.5 py-2 rounded-xl resize-none outline-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveTriageConfig}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>
                Sauvegarder
              </button>
              <button
                onClick={() => { runTriage(messages.filter(m => m.id.startsWith('gmail_')), editingConfig) }}
                disabled={triaging}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(251,146,60,0.12)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.2)' }}>
                <Sparkles className="w-3 h-3" /> Re-trier
              </button>
              <button onClick={() => setShowTriageConfig(false)}
                className="text-xs px-2 py-1.5 rounded-xl"
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                Fermer
              </button>
            </div>
          </div>
        )}

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
              const src      = SOURCE_CONFIG[msg.source]
              const effPri   = getEffectivePriority(msg, triageResults)
              const pri      = PRIORITY_CONFIG[effPri]
              const cat      = getMsgCategory(msg, triageResults)
              const catCfg   = cat ? CATEGORY_CONFIG[cat] : null
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
                        {catCfg && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                            style={{ background: catCfg.bg, color: catCfg.color, border: `1px solid ${catCfg.color}33` }}>
                            {catCfg.label}
                          </span>
                        )}
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
                    {/* Attached files */}
                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {replyAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                          <Paperclip className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[100px]">{att.name}</span>
                          <button onClick={() => setReplyAttachments(p => p.filter((_, j) => j !== i))}>
                            <X className="w-3 h-3 ml-0.5 hover:text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setShowReply(false); setReplyBody(''); setReplyAttachments([]) }}
                          className="text-xs px-3 py-1.5 rounded-xl"
                          style={{ color: 'rgba(255,255,255,0.35)' }}>
                          Annuler
                        </button>
                        <button onClick={() => replyFileRef.current?.click()}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl"
                          style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <Paperclip className="w-3 h-3" /> Joindre
                        </button>
                        <input ref={replyFileRef} type="file" multiple className="hidden"
                          onChange={e => { readFilesAsBase64(e.target.files, setReplyAttachments); e.target.value = '' }} />
                      </div>
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

            {/* Attached files */}
            {composeAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {composeAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                    <Paperclip className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[140px]">{att.name}</span>
                    <button onClick={() => setComposeAttachments(p => p.filter((_, j) => j !== i))}>
                      <X className="w-3 h-3 ml-0.5 hover:text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => composeFileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl"
                  style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Paperclip className="w-3.5 h-3.5" /> Joindre un fichier
                </button>
                <input ref={composeFileRef} type="file" multiple className="hidden"
                  onChange={e => { readFilesAsBase64(e.target.files, setComposeAttachments); e.target.value = '' }} />
              </div>
              <div className="flex items-center gap-2">
              <button onClick={() => { setShowCompose(false); setComposeAttachments([]) }} className="text-xs px-3 py-2 rounded-xl"
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
        </div>
      )}
    </AppLayout>
  )
}
