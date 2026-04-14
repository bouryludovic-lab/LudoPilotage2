'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { GraduationCap, Plus, Calendar, CheckCircle, Clock, XCircle, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'
import type { CoachingSession } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const STATUS_CONFIG = {
  scheduled:  { label: 'Planifiée',   variant: 'blue'  as const, icon: Clock },
  completed:  { label: 'Terminée',    variant: 'green' as const, icon: CheckCircle },
  cancelled:  { label: 'Annulée',     variant: 'red'   as const, icon: XCircle },
}

const DEMO: CoachingSession[] = [
  { id:'1', studentName:'Sophie M.',  studentEmail:'sophie@ex.com', topic:'Stratégie LinkedIn',        date:'2026-04-15', status:'scheduled', notes:'Travailler le personal branding' },
  { id:'2', studentName:'Lucas B.',   studentEmail:'lucas@ex.com',  topic:'Lancement offre coaching',  date:'2026-04-10', status:'completed', notes:'Bonne session, a bien avancé', aiSummary:'Sophie a défini son ICP et structure son offre. Prochaine étape: créer 3 posts piliers.' },
  { id:'3', studentName:'Camille D.', studentEmail:'cam@ex.com',    topic:'Mindset entrepreneur',      date:'2026-04-08', status:'completed', notes:'Travail sur les croyances limitantes' },
  { id:'4', studentName:'Marc T.',    studentEmail:'marc@ex.com',   topic:'Développement commercial',  date:'2026-04-05', status:'cancelled' },
]

export default function CoachingPage() {
  const [sessions, setSessions]     = useState<CoachingSession[]>(DEMO)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]     = useState<CoachingSession | null>(null)
  const [filter, setFilter]         = useState<CoachingSession['status'] | 'all'>('all')
  const [newSession, setNewSession] = useState({
    studentName: '', studentEmail: '', topic: '', date: '', notes: ''
  })

  const filtered = sessions.filter(s => filter === 'all' || s.status === filter)
  const scheduledCount = sessions.filter(s => s.status === 'scheduled').length
  const completedCount = sessions.filter(s => s.status === 'completed').length

  function createSession() {
    if (!newSession.studentName || !newSession.topic || !newSession.date) {
      toast.error('Nom, sujet et date requis')
      return
    }
    const session: CoachingSession = {
      id: Date.now().toString(),
      studentName:  newSession.studentName,
      studentEmail: newSession.studentEmail,
      topic:        newSession.topic,
      date:         newSession.date,
      status:       'scheduled',
      notes:        newSession.notes,
    }
    setSessions(prev => [...prev, session])
    setShowCreate(false)
    setNewSession({ studentName: '', studentEmail: '', topic: '', date: '', notes: '' })
    toast.success('Session créée !')
  }

  function deleteSession(id: string) {
    setSessions(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function generateAISummary(id: string) {
    setSessions(prev => prev.map(s => s.id === id ? {
      ...s,
      aiSummary: 'Session très productive. Points clés discutés : stratégie de contenu, acquisition clients, positionnement. Prochaines actions définies et validées avec l\'étudiant.',
    } : s))
    if (selected?.id === id) {
      setSelected(prev => prev ? {
        ...prev,
        aiSummary: 'Session très productive. Points clés discutés : stratégie de contenu, acquisition clients, positionnement. Prochaines actions définies et validées avec l\'étudiant.',
      } : null)
    }
    toast.success('Résumé IA généré !')
  }

  return (
    <AppLayout title="Coaching" subtitle="Suivi de tes sessions et élèves">
      <div className="flex gap-4 max-w-5xl h-[calc(100vh-160px)]">

        {/* Left panel */}
        <div className="w-[300px] flex-shrink-0 flex flex-col gap-3">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'À venir', value: scheduledCount, color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
              { label: 'Terminées', value: completedCount, color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <Button variant="primary" size="sm" className="w-full" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" /> Nouvelle session
          </Button>

          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filter === s ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === s ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: filter === s ? '#A78BFA' : 'rgba(255,255,255,0.4)',
                }}
              >
                {s === 'all' ? 'Toutes' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Session list */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>Aucune session</p>
            ) : filtered.map(s => {
              const cfg = STATUS_CONFIG[s.status]
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="w-full text-left rounded-xl p-3.5 transition-all"
                  style={{
                    background: selected?.id === s.id ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected?.id === s.id ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-white/80 truncate">{s.studentName}</p>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.topic}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    <Calendar className="w-3 h-3 inline mr-1" />{formatDate(s.date)}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {!selected ? (
            <EmptyState
              icon={GraduationCap}
              title="Sélectionne une session"
              description="Clique sur une session pour voir les détails et générer un résumé IA"
            />
          ) : (
            <div className="h-full flex flex-col overflow-y-auto">
              <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white/90">{selected.studentName}</h2>
                    <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{selected.studentEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_CONFIG[selected.status].variant} dot>
                      {STATUS_CONFIG[selected.status].label}
                    </Badge>
                    <Button variant="danger" size="icon" onClick={() => deleteSession(selected.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-xs text-white/35 mb-0.5">Sujet</p>
                    <p className="text-sm font-semibold text-white/80">{selected.topic}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-xs text-white/35 mb-0.5">Date</p>
                    <p className="text-sm font-semibold text-white/80">{formatDate(selected.date)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 flex-1">
                {selected.notes && (
                  <div>
                    <p className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-2">Notes</p>
                    <p className="text-sm text-white/65 leading-relaxed">{selected.notes}</p>
                  </div>
                )}

                {/* AI Summary */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <p className="text-xs font-semibold text-violet-300">Résumé IA</p>
                    </div>
                    {!selected.aiSummary && selected.status === 'completed' && (
                      <Button variant="outline" size="sm" onClick={() => generateAISummary(selected.id)}>
                        <Sparkles className="w-3 h-3" /> Générer
                      </Button>
                    )}
                  </div>
                  {selected.aiSummary ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{selected.aiSummary}</p>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {selected.status === 'completed'
                        ? 'Clique sur "Générer" pour obtenir un résumé IA de cette session.'
                        : 'Le résumé IA sera disponible une fois la session terminée.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle session de coaching" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom de l'élève" placeholder="Prénom Nom" value={newSession.studentName}
              onChange={e => setNewSession(p => ({ ...p, studentName: e.target.value }))} required />
            <Input label="Email (optionnel)" type="email" placeholder="email@exemple.com" value={newSession.studentEmail}
              onChange={e => setNewSession(p => ({ ...p, studentEmail: e.target.value }))} />
          </div>
          <Input label="Sujet de la session" placeholder="Ex: Stratégie LinkedIn, Mindset…" value={newSession.topic}
            onChange={e => setNewSession(p => ({ ...p, topic: e.target.value }))} required />
          <Input label="Date" type="date" value={newSession.date}
            onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} required />
          <Textarea label="Notes (optionnel)" placeholder="Points à aborder, objectifs…" value={newSession.notes}
            onChange={e => setNewSession(p => ({ ...p, notes: e.target.value }))} />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={createSession}>Créer la session</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
