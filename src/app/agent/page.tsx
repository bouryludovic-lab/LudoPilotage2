'use client'

import { useState, useRef, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Bot, Send, Plus, Sparkles, Zap, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import type { AIAgent, ChatMessage } from '@/lib/types'
import { toast } from 'sonner'

const DEFAULT_AGENTS: AIAgent[] = [
  {
    id: '1',
    name: 'Assistant Facturation',
    description: 'Aide à rédiger des emails de relance et gérer les factures',
    systemPrompt: 'Tu es un assistant expert en facturation et gestion financière pour entrepreneurs. Tu aides à rédiger des emails professionnels de relance, analyser des situations de paiement, et optimiser le suivi client.',
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

export default function AgentPage() {
  const [agents, setAgents]         = useState<AIAgent[]>(DEFAULT_AGENTS)
  const [selected, setSelected]     = useState<AIAgent | null>(null)
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newAgent, setNewAgent]     = useState({ name: '', description: '', systemPrompt: '' })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function selectAgent(agent: AIAgent) {
    setSelected(agent)
    setMessages([
      {
        role: 'assistant',
        content: `Bonjour ! Je suis **${agent.name}**. ${agent.description}. Comment puis-je t'aider ?`,
        timestamp: new Date().toISOString(),
      }
    ])
    setInput('')
  }

  async function sendMessage() {
    if (!input.trim() || !selected || sending) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const claudeKey = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('config') ?? '{}')?.claudeKey ?? ''
        : ''

      if (!claudeKey) {
        // Simulated response
        await new Promise(r => setTimeout(r, 1000))
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Pour activer l\'IA, configure ta clé Claude API dans Configuration. En attendant, je suis en mode démo.',
          timestamp: new Date().toISOString(),
        }])
        setSending(false)
        return
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: selected.model,
          max_tokens: 1024,
          system: selected.systemPrompt,
          messages: [...messages, userMsg]
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await resp.json()
      const text = data.content?.[0]?.text ?? 'Erreur de réponse.'
      setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date().toISOString() }])
    } catch {
      toast.error('Erreur lors de la communication avec Claude')
    } finally {
      setSending(false)
    }
  }

  function createAgent() {
    if (!newAgent.name || !newAgent.systemPrompt) {
      toast.error('Nom et prompt système requis')
      return
    }
    const agent: AIAgent = {
      id: Date.now().toString(),
      name: newAgent.name,
      description: newAgent.description,
      systemPrompt: newAgent.systemPrompt,
      model: 'claude-sonnet-4-6',
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
      conversations: 0,
    }
    setAgents(prev => [...prev, agent])
    setNewAgent({ name: '', description: '', systemPrompt: '' })
    setShowCreate(false)
    toast.success('Agent créé !')
    selectAgent(agent)
  }

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
                  background: selected?.id === agent.id ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selected?.id === agent.id ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <Bot className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/80 truncate">{agent.name}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{agent.description}</p>
                    {agent.conversations !== undefined && (
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {agent.conversations} conversations
                      </p>
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
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
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
              <div className="px-5 py-3.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                  <Bot className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white/85">{selected.name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{selected.model}</p>
                </div>
                <button
                  onClick={() => { setSelected(null); setMessages([]) }}
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
                        style={{ background: 'rgba(124,58,237,0.15)' }}>
                        <Bot className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                    )}
                    <div
                      className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                      style={msg.role === 'user' ? {
                        background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
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
                {sending && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                      <Bot className="w-3.5 h-3.5 text-violet-400" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
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
                  placeholder="Écris ton message…"
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
