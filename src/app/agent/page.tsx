'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Bot, Send, Plus, Sparkles, Zap, ChevronRight, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'
import { generateInvoiceNum, addDays, ECHEANCE_OPTIONS, formatEur, uid } from '@/lib/utils'
import { AT_TABLES, AT_FIELDS } from '@/lib/types'
import type { AIAgent, ChatMessage, Invoice } from '@/lib/types'
import { toast } from 'sonner'

// ── Claude tool: create_invoice ───────────────────────────────────────────────

const INVOICE_TOOL = {
  name: 'create_invoice',
  description: "Crée une facture réelle dans le système LudoPilotage et l'enregistre en base de données. Utilise cet outil dès que l'utilisateur demande de créer une facture.",
  input_schema: {
    type: 'object' as const,
    properties: {
      clientNom:     { type: 'string', description: 'Nom du client ou de l\'entreprise cliente' },
      clientEmail:   { type: 'string', description: 'Email du client (optionnel)' },
      clientAdresse: { type: 'string', description: 'Adresse du client (optionnel)' },
      lignes: {
        type: 'array',
        description: 'Lignes de prestation de la facture',
        items: {
          type: 'object',
          properties: {
            desc: { type: 'string', description: 'Description de la prestation' },
            qte:  { type: 'number', description: 'Quantité' },
            pu:   { type: 'number', description: 'Prix unitaire HT en euros' },
          },
          required: ['desc', 'qte', 'pu'],
        },
      },
      echeanceDays: { type: 'number', description: 'Délai de paiement en jours : 0, 15, 30, 45 ou 60. Défaut : 30' },
      paiement:     { type: 'string', description: 'Mode de paiement. Défaut : Virement bancaire' },
      notes:        { type: 'string', description: 'Notes ou commentaires (optionnel)' },
      date:         { type: 'string', description: 'Date de la facture YYYY-MM-DD (optionnel, défaut : aujourd\'hui)' },
    },
    required: ['clientNom', 'lignes'],
  },
}

// ── Default agents ────────────────────────────────────────────────────────────

const DEFAULT_AGENTS: AIAgent[] = [
  {
    id: '1',
    name: 'Assistant Facturation',
    description: 'Crée des factures réelles par simple description en langage naturel',
    systemPrompt: '', // built dynamically per request
    model: 'claude-sonnet-4-6',
    active: true,
    createdAt: '2026-01-01',
    conversations: 12,
  },
  {
    id: '2',
    name: 'Coach Business',
    description: 'Conseils stratégiques pour développer ton activité',
    systemPrompt: 'Tu es un coach business expérimenté. Tu aides les entrepreneurs à définir leur stratégie, identifier des opportunités de croissance, et résoudre leurs défis quotidiens.',
    model: 'claude-sonnet-4-6',
    active: true,
    createdAt: '2026-01-15',
    conversations: 8,
  },
]

type ApiMessage = {
  role: 'user' | 'assistant'
  content: string | unknown[]
}

export default function AgentPage() {
  const { factures, clients, profil, addFacture } = useAppStore()

  const [agents, setAgents]           = useState<AIAgent[]>(DEFAULT_AGENTS)
  const [selected, setSelected]       = useState<AIAgent | null>(null)
  const [messages, setMessages]       = useState<ChatMessage[]>([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [showCreate, setShowCreate]   = useState(false)
  const [newAgent, setNewAgent]       = useState({ name: '', description: '', systemPrompt: '' })
  const [lastCreatedNum, setLastCreatedNum] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const apiMsgs   = useRef<ApiMessage[]>([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── System prompt (facturation agent gets dynamic client list) ────────────

  function buildSystemPrompt(agent: AIAgent): string {
    if (agent.id !== '1') return agent.systemPrompt

    const clientList = clients.length > 0
      ? clients.map(c => `- ${c.nom}${c.email ? ` (${c.email})` : ''}`).join('\n')
      : 'Aucun client enregistré pour l\'instant.'

    return `Tu es l'Assistant Facturation de LudoPilotage. Tu crées des factures réelles directement dans le système grâce à l'outil create_invoice.

COMPORTEMENT :
- Quand l'utilisateur demande de créer une facture, collecte : nom client, prestations (description + quantité + prix unitaire HT)
- Si les infos essentielles sont là, appelle directement create_invoice sans attendre
- Sinon, pose 1-2 questions courtes pour compléter
- Après création, confirme avec le numéro de facture et le montant total HT
- Reformule les montants en euros français (ex : 1 200,00 €)

CLIENTS DANS LE SYSTÈME :
${clientList}

PROFIL ENTREPRISE :
Nom : ${profil.nom || 'Non configuré'}
SIRET : ${profil.siret || 'N/A'}
Préfixe factures : ${profil.prefix || 'F-'}
IBAN : ${profil.iban || 'Non configuré'}

Tu peux aussi aider à rédiger des emails de relance et conseiller sur la gestion financière.`
  }

  // ── Select agent ──────────────────────────────────────────────────────────

  function selectAgent(agent: AIAgent) {
    setSelected(agent)
    apiMsgs.current = []
    setLastCreatedNum(null)
    setMessages([{
      role: 'assistant',
      content: agent.id === '1'
        ? `Bonjour ! Je suis votre **Assistant Facturation**.\n\nJe peux créer des factures directement dans votre système. Dites-moi par exemple :\n• "Facture pour Jean Dupont, 2 jours de conseil à 800€"\n• "Crée une facture pour Acme Corp, développement web 3 500€"\n\nQue souhaitez-vous faire ?`
        : `Bonjour ! Je suis **${agent.name}**. ${agent.description}. Comment puis-je vous aider ?`,
      timestamp: new Date().toISOString(),
    }])
    setInput('')
  }

  // ── Execute create_invoice tool ───────────────────────────────────────────

  async function executeCreateInvoice(toolInput: Record<string, unknown>): Promise<Invoice | null> {
    const userEmail    = storage.getToken()
    const today        = new Date().toISOString().split('T')[0]
    const date         = (toolInput.date as string) || today
    const echeanceDays = (toolInput.echeanceDays as number) ?? 30
    const echeance     = addDays(date, echeanceDays)
    const echeanceLabel = ECHEANCE_OPTIONS.find(o => o.days === echeanceDays)?.label ?? `${echeanceDays} jours`
    const clientNom    = toolInput.clientNom as string
    const lignes       = toolInput.lignes as Array<{ desc: string; qte: number; pu: number }>
    const matched      = clients.find(c => c.nom.toLowerCase().includes(clientNom.toLowerCase()))

    const invoice: Invoice = {
      id:            uid(),
      num:           generateInvoiceNum(profil.prefix || 'F-', factures.map(f => f.num)),
      date,
      echeance,
      echeanceLabel,
      clientId:      matched?.id || '',
      clientNom,
      clientEmail:   (toolInput.clientEmail as string) || matched?.email || '',
      clientAdresse: (toolInput.clientAdresse as string) || matched?.adresse || '',
      clientSiret:   matched?.siret || '',
      paiement:      (toolInput.paiement as string) || 'Virement bancaire',
      iban:          profil.iban || '',
      notes:         (toolInput.notes as string) || '',
      lignes,
      total:         lignes.reduce((s, l) => s + l.qte * l.pu, 0),
      statut:        'pending',
      userEmail,
    }

    // Save to Airtable via server proxy
    try {
      const F   = AT_FIELDS
      const res = await fetch('/api/airtable', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table:  AT_TABLES.factures,
          method: 'POST',
          fields: {
            [F.factures.num]:          invoice.num,
            [F.factures.client_nom]:   invoice.clientNom,
            [F.factures.client_email]: invoice.clientEmail,
            [F.factures.montant]:      invoice.total,
            [F.factures.date]:         invoice.date,
            [F.factures.echeance]:     invoice.echeance,
            [F.factures.statut]:       invoice.statut,
            [F.factures.prestation]:   JSON.stringify(invoice.lignes),
            [F.factures.paiement]:     invoice.paiement,
            [F.factures.notes]:        invoice.notes,
            [F.factures.user_email]:   userEmail,
          },
        }),
      })
      if (res.ok) {
        const d = await res.json()
        invoice.atId = d.records?.[0]?.id
      }
    } catch {
      // Continue — invoice saved locally even if Airtable fails
    }

    addFacture(invoice)
    return invoice
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    if (!input.trim() || !selected || sending) return

    const text    = input.trim()
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }

    setMessages(prev => [...prev, userMsg])
    apiMsgs.current.push({ role: 'user', content: text })
    setInput('')
    setSending(true)
    setLastCreatedNum(null)

    const isFacturation = selected.id === '1'
    const systemPrompt  = buildSystemPrompt(selected)

    try {
      // ── First API call ───────────────────────────────────────────────────
      const r1  = await fetch('/api/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       selected.model,
          maxTokens:   1500,
          systemPrompt,
          messages:    apiMsgs.current,
          tools:       isFacturation ? [INVOICE_TOOL] : undefined,
        }),
      })
      const d1 = await r1.json()

      if (!r1.ok) {
        const errMsg = d1.error ?? 'Erreur IA'
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: errMsg.includes('ANTHROPIC_API_KEY')
            ? "La clé API Claude n'est pas configurée. Ajoute `ANTHROPIC_API_KEY` dans les variables d'environnement Vercel."
            : `Erreur : ${errMsg}`,
          timestamp: new Date().toISOString(),
        }])
        return
      }

      // ── Tool use: create_invoice ─────────────────────────────────────────
      if (d1.stopReason === 'tool_use' && d1.toolUse?.name === 'create_invoice') {
        // Record assistant tool_use in API history
        apiMsgs.current.push({
          role: 'assistant',
          content: [{
            type:  'tool_use',
            id:    d1.toolUse.id,
            name:  d1.toolUse.name,
            input: d1.toolUse.input,
          }],
        })

        // Execute the tool
        const invoice = await executeCreateInvoice(d1.toolUse.input)

        const resultContent = invoice
          ? `Facture créée. Numéro : ${invoice.num}. Montant HT : ${formatEur(invoice.total)}. Client : ${invoice.clientNom}.`
          : 'Erreur lors de la création de la facture.'

        // Record tool result in API history
        apiMsgs.current.push({
          role: 'user',
          content: [{
            type:        'tool_result',
            tool_use_id: d1.toolUse.id,
            content:     resultContent,
          }],
        })

        // ── Second API call: final confirmation ──────────────────────────
        const r2  = await fetch('/api/claude', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model:       selected.model,
            maxTokens:   1024,
            systemPrompt,
            messages:    apiMsgs.current,
            tools:       [INVOICE_TOOL],
          }),
        })
        const d2        = await r2.json()
        const finalText = d2.text || (invoice ? `Facture **${invoice.num}** créée avec succès !` : 'Une erreur est survenue.')

        apiMsgs.current.push({ role: 'assistant', content: finalText })
        setMessages(prev => [...prev, { role: 'assistant', content: finalText, timestamp: new Date().toISOString() }])
        if (invoice) setLastCreatedNum(invoice.num)

      } else {
        // ── Normal text response ─────────────────────────────────────────
        const responseText = d1.text || ''
        apiMsgs.current.push({ role: 'assistant', content: responseText })
        setMessages(prev => [...prev, { role: 'assistant', content: responseText, timestamp: new Date().toISOString() }])
      }

    } catch {
      toast.error('Erreur lors de la communication avec Claude')
    } finally {
      setSending(false)
    }
  }

  // ── Create custom agent ───────────────────────────────────────────────────

  function createAgent() {
    if (!newAgent.name || !newAgent.systemPrompt) {
      toast.error('Nom et prompt système requis')
      return
    }
    const agent: AIAgent = {
      id:           Date.now().toString(),
      name:         newAgent.name,
      description:  newAgent.description,
      systemPrompt: newAgent.systemPrompt,
      model:        'claude-sonnet-4-6',
      active:       true,
      createdAt:    new Date().toISOString().split('T')[0],
      conversations: 0,
    }
    setAgents(prev => [...prev, agent])
    setNewAgent({ name: '', description: '', systemPrompt: '' })
    setShowCreate(false)
    toast.success('Agent créé !')
    selectAgent(agent)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Agent IA" subtitle="Crée et interagis avec tes agents IA personnalisés">
      <div className="flex gap-4 h-[calc(100vh-140px)]">

        {/* Agent list */}
        <div className="w-[260px] flex-shrink-0 flex flex-col gap-2">
          <Button variant="primary" size="sm" className="w-full" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Nouvel agent
          </Button>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className="w-full text-left rounded-2xl p-3.5 transition-all"
                style={{
                  background: selected?.id === agent.id ? 'rgba(59,107,232,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selected?.id === agent.id ? 'rgba(59,107,232,0.28)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(59,107,232,0.12)' }}>
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{agent.name}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{agent.description}</p>
                    {agent.id === '1' && (
                      <p className="text-xs mt-1 text-violet-400/60 font-medium">Outil : création facture</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>

          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(59,107,232,0.1)', border: '1px solid rgba(59,107,232,0.15)' }}>
                <Sparkles className="w-7 h-7 text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-white/70 mb-1">Sélectionne un agent</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Choisis un agent à gauche ou crée-en un nouveau
                </p>
              </div>
              {agents.length > 0 && (
                <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                  {agents.slice(0, 3).map(a => (
                    <button key={a.id} onClick={() => selectAgent(a)}
                      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all hover:bg-white/5"
                      style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Bot className="w-4 h-4 text-violet-400 flex-shrink-0" />
                      <span className="flex-1 text-left text-white/65">{a.name}</span>
                      <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3.5 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,107,232,0.12)' }}>
                  <Bot className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/85">{selected.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{selected.model}</p>
                </div>
                <button
                  onClick={() => { setSelected(null); setMessages([]); apiMsgs.current = [] }}
                  className="ml-auto p-1.5 rounded-lg hover:bg-white/6 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5"
                        style={{ background: 'rgba(59,107,232,0.12)' }}>
                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                    )}
                    <div
                      className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                      style={msg.role === 'user' ? {
                        background: 'linear-gradient(135deg, #3B6BE8, #2563EB)',
                        color: 'white',
                        borderBottomRightRadius: '4px',
                      } : {
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.8)',
                        borderBottomLeftRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Invoice created banner */}
                {lastCreatedNum && !sending && (
                  <div className="flex justify-start">
                    <div className="ml-9 flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
                      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderBottomLeftRadius: '4px' }}>
                      <FileText className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                        Facture <strong className="text-white">{lastCreatedNum}</strong> enregistrée
                      </span>
                      <Link href="/factures"
                        className="ml-1 text-violet-400 hover:text-violet-300 font-semibold transition-colors text-xs">
                        Voir les factures →
                      </Link>
                    </div>
                  </div>
                )}

                {sending && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(59,107,232,0.12)' }}>
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <input
                  className="input-dark flex-1"
                  placeholder={selected.id === '1' ? 'Ex: Facture pour Jean Dupont, 2 jours à 800€…' : 'Écris ton message…'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  disabled={sending}
                />
                <Button variant="primary" size="icon" onClick={sendMessage} loading={sending} className="w-11 h-11">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create agent modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer un agent IA" size="md">
        <div className="space-y-4">
          <Input label="Nom de l'agent" placeholder="Ex: Assistant Facturation" value={newAgent.name}
            onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))} required />
          <Input label="Description courte" placeholder="Ex: Aide à relancer les factures impayées" value={newAgent.description}
            onChange={e => setNewAgent(p => ({ ...p, description: e.target.value }))} />
          <Textarea label="Prompt système" placeholder="Tu es un assistant expert en..." value={newAgent.systemPrompt}
            onChange={e => setNewAgent(p => ({ ...p, systemPrompt: e.target.value }))} required
            className="min-h-[120px]" />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={createAgent}>
              <Zap className="w-3.5 h-3.5" />
              Créer l'agent
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
