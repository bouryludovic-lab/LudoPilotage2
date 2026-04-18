'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import {
  GraduationCap, RefreshCw, Copy, Check, Sparkles, ChevronDown, ChevronUp,
  Send, Bot, Settings, ExternalLink, FileText, Clock, CheckCircle2, Mail,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'
import { AT_TABLES, AT_FIELDS } from '@/lib/types'
import type { CoachingSubmission, CoachingConfig } from '@/lib/types'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
  } catch { return d }
}

function parseSubmission(rec: { id: string; fields: Record<string, unknown> }): CoachingSubmission {
  const f = rec.fields
  const F = AT_FIELDS
  let questionType: CoachingSubmission['questionType'] = 'general'
  let pdfUrls: string[] = []
  try {
    const notes = JSON.parse(String(f[F.coaching.notes] ?? '{}'))
    questionType = (['offre', 'promesse', 'general'].includes(notes.type) ? notes.type : 'general') as CoachingSubmission['questionType']
    pdfUrls = Array.isArray(notes.pdfUrls) ? notes.pdfUrls : []
  } catch { /* use defaults */ }
  return {
    id:           rec.id,
    atId:         rec.id,
    studentName:  String(f[F.coaching.student_name]  ?? ''),
    studentEmail: String(f[F.coaching.student_email] ?? ''),
    question:     String(f[F.coaching.topic]         ?? ''),
    questionType,
    pdfUrls,
    date:         String(f[F.coaching.date]          ?? ''),
    status:       (String(f[F.coaching.status]       ?? 'new')) as CoachingSubmission['status'],
    aiResponse:   String(f[F.coaching.ai_summary]    ?? ''),
    userEmail:    String(f[F.coaching.user_email]    ?? ''),
  }
}

const TYPE_LABEL: Record<CoachingSubmission['questionType'], string> = {
  offre:    'Offre',
  promesse: 'Promesse',
  general:  'Général',
}
const TYPE_COLOR: Record<CoachingSubmission['questionType'], string> = {
  offre:    'rgba(99,102,241,0.2)',
  promesse: 'rgba(34,197,94,0.15)',
  general:  'rgba(255,255,255,0.08)',
}
const TYPE_TEXT: Record<CoachingSubmission['questionType'], string> = {
  offre:    '#a5b4fc',
  promesse: '#86efac',
  general:  'rgba(255,255,255,0.45)',
}
const STATUS_DOT: Record<CoachingSubmission['status'], string> = {
  new:   '#f59e0b',
  draft: '#60a5fa',
  sent:  '#34d399',
}

interface AgentMsg { role: 'user' | 'assistant'; content: string }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoachingPage() {
  const { profil } = useAppStore()
  const userEmail  = storage.getToken()

  const [submissions, setSubmissions] = useState<CoachingSubmission[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<CoachingSubmission | null>(null)

  const [editedResponse, setEditedResponse] = useState('')
  const [generating, setGenerating]         = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [savingResponse, setSavingResponse] = useState(false)

  const [showConfig, setShowConfig]     = useState(false)
  const [config, setConfig]             = useState<CoachingConfig>({ offre: '', promesse: '', programContent: '' })
  const [configDirty, setConfigDirty]   = useState(false)

  const [showChat, setShowChat]         = useState(false)
  const [chatInput, setChatInput]       = useState('')
  const [chatMsgs, setChatMsgs]         = useState<AgentMsg[]>([])
  const [chatSending, setChatSending]   = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const [filter, setFilter] = useState<CoachingSubmission['status'] | 'all'>('all')

  // Load config from localStorage
  useEffect(() => { setConfig(storage.getCoachingConfig()) }, [])

  // Fetch submissions from Airtable
  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: AT_TABLES.coaching,
          method: 'GET',
          useFieldNames: true,
          query: userEmail
            ? `filterByFormula=${encodeURIComponent(`{${AT_FIELDS.coaching.user_email}}="${userEmail}"`)}&sort[0][field]=${AT_FIELDS.coaching.date}&sort[0][direction]=desc`
            : undefined,
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setSubmissions((data.records ?? []).map(parseSubmission))
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [userEmail])

  useEffect(() => {
    fetchSubmissions()
    const t = setInterval(fetchSubmissions, 30_000)
    return () => clearInterval(t)
  }, [fetchSubmissions])

  // When a submission is selected — sync response & auto-generate if new
  useEffect(() => {
    if (!selected) return
    setEditedResponse(selected.aiResponse)
    setChatMsgs([])
    setShowChat(false)
    if (selected.status === 'new' && !selected.aiResponse) void autoGenerate(selected)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // Scroll chat to bottom
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMsgs])

  // ── System prompt ────────────────────────────────────────────────────────────

  function buildSystemPrompt() {
    return `Tu es l'assistant personnel de ${profil.nom || 'le coach'}, spécialiste en coaching business.

TON RÔLE : Rédiger des réponses personnalisées, chaleureuses et professionnelles aux questions des élèves.

${config.offre ? `OFFRE (ce qui est proposé — format, modules, prix, durée) :\n${config.offre}\n` : ''}
${config.promesse ? `PROMESSE (la transformation attendue — résultats, état final, bénéfices) :\n${config.promesse}\n` : ''}
${config.programContent ? `CONTENU DU PROGRAMME :\n${config.programContent}\n` : ''}

DISTINCTION OFFRE / PROMESSE :
- L'OFFRE = ce qui est concret : format, modules, durée, prix, livrables
- La PROMESSE = la transformation : résultats obtenus, état final, bénéfices réels

INSTRUCTIONS :
1. Utilise le prénom de l'élève pour personnaliser
2. Si question sur l'offre → détaille les éléments concrets
3. Si question sur la promesse → parle de la transformation et résultats
4. Ton chaleureux, direct, enthousiaste — 3 à 5 paragraphes
5. Termine par une invitation positive à continuer l'échange
6. Ne mentionne pas que tu es une IA`
  }

  // ── AI generation ────────────────────────────────────────────────────────────

  async function autoGenerate(sub: CoachingSubmission) {
    setGenerating(true)
    try {
      const userMsg = `Élève : ${sub.studentName}${sub.studentEmail ? ` (${sub.studentEmail})` : ''}
Type de question : ${TYPE_LABEL[sub.questionType]}
Date : ${fmtDate(sub.date)}

Question :
"${sub.question}"${sub.pdfUrls.length > 0 ? `\n\nPDFs joints : ${sub.pdfUrls.join(', ')}` : ''}`

      const res  = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          maxTokens: 1500,
          systemPrompt: buildSystemPrompt(),
          messages: [{ role: 'user', content: userMsg }],
        }),
      })
      const data = await res.json()
      const text = data.text || ''
      setEditedResponse(text)
      if (sub.atId) await patchAirtable(sub.atId, text, 'draft')
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, aiResponse: text, status: 'draft' } : s))
      setSelected(prev => prev?.id === sub.id ? { ...prev, aiResponse: text, status: 'draft' } : prev)
    } catch { toast.error('Erreur lors de la génération IA') }
    finally    { setGenerating(false) }
  }

  async function patchAirtable(atId: string, aiResponse: string, status: string) {
    await fetch('/api/airtable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: AT_TABLES.coaching, method: 'PATCH', id: atId,
        fields: { [AT_FIELDS.coaching.ai_summary]: aiResponse, [AT_FIELDS.coaching.status]: status },
      }),
    })
  }

  async function saveResponse() {
    if (!selected?.atId) return
    setSavingResponse(true)
    try {
      await patchAirtable(selected.atId, editedResponse, 'draft')
      setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, aiResponse: editedResponse } : s))
      setSelected(prev => prev ? { ...prev, aiResponse: editedResponse } : prev)
      toast.success('Réponse sauvegardée')
    } catch { toast.error('Erreur de sauvegarde') }
    finally   { setSavingResponse(false) }
  }

  async function markSent() {
    if (!selected?.atId) return
    await patchAirtable(selected.atId, editedResponse, 'sent')
    setSubmissions(prev => prev.map(s => s.id === selected.id ? { ...s, status: 'sent' } : s))
    setSelected(prev => prev ? { ...prev, status: 'sent' } : prev)
    toast.success('Marquée comme envoyée ✓')
  }

  function copyResponse() {
    navigator.clipboard.writeText(editedResponse)
    setCopied(true)
    toast.success('Réponse copiée — colle-la en message privé')
    setTimeout(() => setCopied(false), 2500)
  }

  function saveConfig() {
    storage.setCoachingConfig(config)
    setConfigDirty(false)
    toast.success('Configuration sauvegardée')
  }

  // ── Agent chat ───────────────────────────────────────────────────────────────

  async function sendChat() {
    if (!chatInput.trim() || !selected || chatSending) return
    const text = chatInput.trim()
    setChatMsgs(prev => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setChatSending(true)
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          maxTokens: 1024,
          systemPrompt: buildSystemPrompt() + `\n\nCONTEXTE DE LA SOUMISSION :\nÉlève : ${selected.studentName}\nQuestion : "${selected.question}"\nRéponse actuelle :\n"${editedResponse}"`,
          messages: [...chatMsgs.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: text }],
        }),
      })
      const data = await res.json()
      setChatMsgs(prev => [...prev, { role: 'assistant', content: data.text || '' }])
    } catch { toast.error('Erreur de communication avec Claude') }
    finally   { setChatSending(false) }
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const filtered   = submissions.filter(s => filter === 'all' || s.status === filter)
  const newCount   = submissions.filter(s => s.status === 'new').length
  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/coaching/webhook?email=${encodeURIComponent(userEmail)}`
    : '/api/coaching/webhook'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Coaching" subtitle="Questions des élèves avec réponses IA automatiques">
      <div className="flex gap-4 h-[calc(100vh-140px)]">

        {/* ── LEFT PANEL ── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">

          {/* Config: offre & promesse */}
          <div className="rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <button onClick={() => setShowConfig(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/4"
              style={{ color: 'rgba(255,255,255,0.65)' }}>
              <span className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-violet-400" />
                Offre &amp; Promesse
                {(!config.offre || !config.promesse) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24' }}>à configurer</span>
                )}
              </span>
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showConfig && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Offre <span className="text-indigo-400">(ce que tu vends)</span>
                  </label>
                  <textarea rows={3} value={config.offre}
                    onChange={e => { setConfig(p => ({ ...p, offre: e.target.value })); setConfigDirty(true) }}
                    placeholder="Format, modules, durée, prix…"
                    className="w-full text-xs rounded-xl px-3 py-2 resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', outline: 'none' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Promesse <span className="text-green-400">(la transformation)</span>
                  </label>
                  <textarea rows={3} value={config.promesse}
                    onChange={e => { setConfig(p => ({ ...p, promesse: e.target.value })); setConfigDirty(true) }}
                    placeholder="Résultats, transformation, état final…"
                    className="w-full text-xs rounded-xl px-3 py-2 resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', outline: 'none' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Contenu programme <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optionnel — colle ton PDF)</span>
                  </label>
                  <textarea rows={3} value={config.programContent}
                    onChange={e => { setConfig(p => ({ ...p, programContent: e.target.value })); setConfigDirty(true) }}
                    placeholder="Colle ici le texte de ton programme…"
                    className="w-full text-xs rounded-xl px-3 py-2 resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', outline: 'none' }} />
                </div>
                {configDirty && (
                  <button onClick={saveConfig}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#3B6BE8,#2563EB)' }}>
                    Sauvegarder
                  </button>
                )}
                <div>
                  <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    URL WEBHOOK (pour ton formulaire)
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 text-[9px] px-2 py-1.5 rounded-lg truncate"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#a5b4fc', border: '1px solid rgba(255,255,255,0.06)' }}>
                      /api/coaching/webhook?email={userEmail.slice(0, 20)}{userEmail.length > 20 ? '…' : ''}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiée !') }}
                      className="p-1.5 rounded-lg hover:bg-white/8 transition-colors flex-shrink-0"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            {(['all', 'new', 'draft', 'sent'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filter === f ? 'rgba(59,107,232,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === f ? 'rgba(59,107,232,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  color: filter === f ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                }}>
                {f === 'all'   ? `Tous (${submissions.length})`
                : f === 'new'  ? `Nouveaux${newCount > 0 ? ` (${newCount})` : ''}`
                : f === 'draft'? 'Brouillon'
                :                'Envoyés'}
              </button>
            ))}
            <button onClick={fetchSubmissions}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Submission list */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading ? (
              <div className="text-center py-10 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: 'white' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {submissions.length === 0 ? 'En attente de soumissions' : 'Aucune soumission ici'}
                </p>
              </div>
            ) : (
              filtered.map(s => (
                <button key={s.id} onClick={() => setSelected(s)}
                  className="w-full text-left rounded-2xl p-3.5 transition-all"
                  style={{
                    background: selected?.id === s.id ? 'rgba(59,107,232,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected?.id === s.id ? 'rgba(59,107,232,0.22)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-white/80 truncate">{s.studentName}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[s.status] }} />
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                        style={{ background: TYPE_COLOR[s.questionType], color: TYPE_TEXT[s.questionType] }}>
                        {TYPE_LABEL[s.questionType]}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.question}</p>
                  <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{fmtDate(s.date)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden min-w-0"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(59,107,232,0.1)', border: '1px solid rgba(124,58,237,0.18)' }}>
                <GraduationCap className="w-7 h-7 text-violet-400" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-base font-bold text-white/70 mb-1">Sélectionne une soumission</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Les réponses IA sont générées automatiquement dès qu'une question est reçue via ton formulaire.
                </p>
                {submissions.length === 0 && !loading && (
                  <div className="mt-4 p-3 rounded-xl text-xs text-left"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                    Configure ton formulaire (Typeform, Tally, JotForm…) avec le webhook :<br/>
                    <code className="text-violet-400 text-[10px] break-all">{webhookUrl}</code>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Header */}
              <div className="px-5 py-4 flex items-start justify-between gap-3 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h2 className="text-base font-bold text-white/90">{selected.studentName}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: TYPE_COLOR[selected.questionType], color: TYPE_TEXT[selected.questionType] }}>
                      {TYPE_LABEL[selected.questionType]}
                    </span>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[selected.status] }} />
                    <span className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.3)' }}>{selected.status}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {selected.studentEmail} · {fmtDate(selected.date)}
                  </p>
                </div>
                {selected.status !== 'sent' && (
                  <button onClick={markSent}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#6ee7b7' }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Marquer envoyée
                  </button>
                )}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* Question block */}
                <div className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs font-semibold mb-2 tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    QUESTION DE L'ÉLÈVE
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{selected.question}</p>
                  {selected.pdfUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selected.pdfUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs hover:bg-white/8 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#a5b4fc' }}>
                          <FileText className="w-3 h-3" /> PDF joint {i + 1} <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Response */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      RÉPONSE IA <span style={{ color: 'rgba(255,255,255,0.18)' }}>(modifiable)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => autoGenerate(selected)} disabled={generating}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ background: 'rgba(59,107,232,0.1)', border: '1px solid rgba(59,107,232,0.15)', color: '#c4b5fd' }}>
                        {generating
                          ? <><Clock className="w-3 h-3 animate-spin" /> Génération…</>
                          : <><Sparkles className="w-3 h-3" /> Régénérer</>}
                      </button>
                      <button onClick={() => setShowChat(p => !p)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: showChat ? 'rgba(59,107,232,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${showChat ? 'rgba(59,107,232,0.28)' : 'rgba(255,255,255,0.08)'}`,
                          color: showChat ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                        }}>
                        <Bot className="w-3 h-3" /> Questionner l'agent
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={editedResponse}
                    onChange={e => setEditedResponse(e.target.value)}
                    rows={10}
                    disabled={generating}
                    placeholder={generating ? 'Génération en cours…' : 'La réponse IA apparaîtra ici…'}
                    className="w-full rounded-2xl px-4 py-3 text-sm leading-relaxed resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {editedResponse !== selected.aiResponse && (
                      <button onClick={saveResponse} disabled={savingResponse}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: 'rgba(59,107,232,0.22)', border: '1px solid rgba(59,107,232,0.3)' }}>
                        {savingResponse ? 'Sauvegarde…' : 'Sauvegarder'}
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={copyResponse} disabled={!editedResponse}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.55)' }}
                        title="Copier pour message privé (Instagram, WhatsApp…)">
                        <Mail className="w-3.5 h-3.5" /> Message privé
                      </button>
                      <button onClick={copyResponse} disabled={!editedResponse}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: copied ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg,#3B6BE8,#2563EB)', border: copied ? '1px solid rgba(52,211,153,0.4)' : 'none' }}>
                        {copied ? <><Check className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier la réponse</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Agent chat */}
                {showChat && (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(59,107,232,0.15)', background: 'rgba(124,58,237,0.03)' }}>
                    <div className="px-4 py-2.5 flex items-center gap-2"
                      style={{ borderBottom: '1px solid rgba(59,107,232,0.1)' }}>
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Demande à l'agent de reformuler, ajuster, raccourcir…
                      </span>
                    </div>
                    <div className="p-3 space-y-2.5 max-h-52 overflow-y-auto">
                      {chatMsgs.length === 0 && (
                        <p className="text-xs text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                          Ex : "Raccourcis en 3 phrases", "Ajoute un appel à l'action", "Reformule en tenant compte de l'offre premium"
                        </p>
                      )}
                      {chatMsgs.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
                            style={m.role === 'user'
                              ? { background: 'rgba(59,107,232,0.18)', color: 'white' }
                              : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      {chatSending && (
                        <div className="flex justify-start">
                          <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <div className="flex gap-1">
                              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />)}
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>
                    <div className="p-3 flex gap-2" style={{ borderTop: '1px solid rgba(59,107,232,0.1)' }}>
                      <input
                        className="flex-1 rounded-xl px-3 py-2 text-xs"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', outline: 'none' }}
                        placeholder="Reformule, raccourcis, ajoute un élément…"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())}
                        disabled={chatSending}
                      />
                      <button onClick={sendChat} disabled={chatSending || !chatInput.trim()}
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#3B6BE8,#2563EB)' }}>
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
