'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAppStore } from '@/store'
import { sendViaWebhook } from '@/lib/airtable'
import { formatDate } from '@/lib/utils'

interface CoachingQuestion {
  id: string
  question: string
  reponse?: string
  date: string
  statut: 'pending' | 'answered'
}

export default function CoachingPage() {
  const { config } = useAppStore()
  const [questions, setQuestions] = useState<CoachingQuestion[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!newQuestion.trim()) return
    if (!config.webhook) {
      toast.error('Webhook Make non configuré')
      return
    }

    setSending(true)
    const q: CoachingQuestion = {
      id:       `${Date.now()}`,
      question: newQuestion.trim(),
      date:     new Date().toISOString(),
      statut:   'pending',
    }
    setQuestions(prev => [q, ...prev])
    setNewQuestion('')

    try {
      const res = await sendViaWebhook(config.webhook, {
        action: 'coaching_question',
        question: q.question,
        date: q.date,
      })

      const text = await res.text().catch(() => '')
      let reponse = text
      try {
        const json = JSON.parse(text)
        reponse = json.reponse ?? json.response ?? json.answer ?? text
      } catch {}

      setQuestions(prev =>
        prev.map(item => item.id === q.id ? { ...item, reponse, statut: 'answered' } : item)
      )
    } catch (e) {
      toast.error('Erreur lors de l\'envoi au webhook')
      setQuestions(prev => prev.filter(item => item.id !== q.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout title="Questions élèves" subtitle="Coaching & réponses via l'assistant IA">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* New question */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Nouvelle question</h2>
          <div className="flex gap-2">
            <textarea
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSend() }}
              placeholder="Posez une question à l'assistant…"
              rows={3}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!newQuestion.trim() || sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 self-end"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Cmd+Entrée pour envoyer</p>
        </div>

        {/* Questions list */}
        {questions.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Aucune question"
            description="Posez votre première question à l'assistant ci-dessus."
          />
        ) : (
          <div className="space-y-3">
            {questions.map(q => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium text-slate-900">{q.question}</p>
                  <span className="text-xs text-slate-400 ml-3 flex-shrink-0">{formatDate(q.date)}</span>
                </div>
                {q.statut === 'pending' ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> En attente de réponse…
                  </div>
                ) : (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm text-slate-700 border border-blue-100">
                    {q.reponse}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
