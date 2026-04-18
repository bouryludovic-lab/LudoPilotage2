'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { ClipboardList, Plus, Eye, Download, Trash2, FileText, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { toast } from 'sonner'
import type { FormTemplate, FormField } from '@/lib/types'

const DEMO_FORMS: FormTemplate[] = [
  {
    id: '1',
    name: 'Devis standard',
    description: 'Formulaire de demande de devis pour nouveaux clients',
    fields: [
      { id: 'f1', type: 'text',     label: 'Nom complet',        required: true },
      { id: 'f2', type: 'email',    label: 'Email',              required: true },
      { id: 'f3', type: 'textarea', label: 'Besoin / projet',    required: true },
      { id: 'f4', type: 'number',   label: 'Budget estimé (€)',  required: false },
    ],
    createdAt: '2026-01-10',
    submissions: 24,
  },
  {
    id: '2',
    name: 'Contrat de coaching',
    description: 'Formulaire d\'engagement pour les sessions de coaching',
    fields: [
      { id: 'f1', type: 'text',     label: 'Prénom / Nom',      required: true },
      { id: 'f2', type: 'email',    label: 'Email',             required: true },
      { id: 'f3', type: 'select',   label: 'Programme',         required: true, options: ['Starter 3 mois', 'Pro 6 mois', 'Elite 12 mois'] },
      { id: 'f4', type: 'checkbox', label: 'J\'accepte les CGV', required: true },
    ],
    createdAt: '2026-02-01',
    submissions: 11,
  },
]

const FIELD_TYPES = [
  { value: 'text',     label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
  { value: 'email',    label: 'Email' },
  { value: 'number',   label: 'Nombre' },
  { value: 'date',     label: 'Date' },
  { value: 'select',   label: 'Liste déroulante' },
  { value: 'checkbox', label: 'Case à cocher' },
] as const

export default function FormulairesPage() {
  const [forms, setForms]           = useState<FormTemplate[]>(DEMO_FORMS)
  const [showCreate, setShowCreate] = useState(false)
  const [previewId, setPreviewId]   = useState<string | null>(null)
  const [newForm, setNewForm]       = useState({ name: '', description: '' })
  const [fields, setFields]         = useState<FormField[]>([
    { id: '1', type: 'text', label: '', required: false }
  ])

  function addField() {
    setFields(prev => [...prev, { id: Date.now().toString(), type: 'text', label: '', required: false }])
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id))
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  function createForm() {
    if (!newForm.name || fields.some(f => !f.label)) {
      toast.error('Nom du formulaire et labels des champs requis')
      return
    }
    const form: FormTemplate = {
      id: Date.now().toString(),
      name: newForm.name,
      description: newForm.description,
      fields: fields.filter(f => f.label),
      createdAt: new Date().toISOString().split('T')[0],
      submissions: 0,
    }
    setForms(prev => [...prev, form])
    setShowCreate(false)
    setNewForm({ name: '', description: '' })
    setFields([{ id: '1', type: 'text', label: '', required: false }])
    toast.success('Formulaire créé !')
  }

  function deleteForm(id: string) {
    setForms(prev => prev.filter(f => f.id !== id))
    toast.success('Formulaire supprimé')
  }

  const previewForm = forms.find(f => f.id === previewId)

  return (
    <AppLayout title="Formulaires & PDF" subtitle="Crée des formulaires et génère des PDFs automatiquement">
      <div className="max-w-5xl space-y-4">

        {/* Header action */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div className="rounded-2xl px-4 py-2.5 flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <ClipboardList className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-white/70">{forms.length} formulaires</span>
            </div>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5" />
            Nouveau formulaire
          </Button>
        </div>

        {forms.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Aucun formulaire"
            description="Crée ton premier formulaire pour collecter des informations et générer des PDFs"
            action={{ label: 'Créer un formulaire', onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {forms.map(form => (
              <div key={form.id} className="rounded-2xl p-5 group"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,107,232,0.1)', border: '1px solid rgba(59,107,232,0.15)' }}>
                    <FileText className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white/85">{form.name}</h3>
                    {form.description && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{form.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <Badge variant="violet" dot>{form.fields.length} champs</Badge>
                  {form.submissions !== undefined && (
                    <Badge variant="green" dot>{form.submissions} soumissions</Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPreviewId(form.id)}>
                    <Eye className="w-3.5 h-3.5" />
                    Aperçu
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </Button>
                  <Button variant="danger" size="icon" onClick={() => deleteForm(form.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coming soon */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(59,107,232,0.08)', border: '1px solid rgba(59,107,232,0.12)' }}>
          <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400" />
          <div>
            <p className="text-xs font-semibold text-violet-300 mb-0.5">Génération PDF automatique</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Connecte tes formulaires à Make pour générer automatiquement des PDFs et les envoyer par email.
            </p>
          </div>
        </div>
      </div>

      {/* Create form modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer un formulaire" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nom du formulaire" placeholder="Ex: Devis client" value={newForm.name}
              onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} required />
            <Input label="Description (optionnel)" placeholder="À quoi sert ce formulaire ?" value={newForm.description}
              onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Champs</label>
              <Button variant="ghost" size="sm" onClick={addField}>
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs text-white/25 w-4 text-center">{i + 1}</span>
                  <select
                    value={field.type}
                    onChange={e => updateField(field.id, { type: e.target.value as FormField['type'] })}
                    className="input-dark w-36 text-xs py-2"
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    className="input-dark flex-1 text-sm py-2"
                    placeholder="Label du champ"
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-white/40 whitespace-nowrap">
                    <input type="checkbox" checked={field.required}
                      onChange={e => updateField(field.id, { required: e.target.checked })}
                      className="rounded" />
                    Requis
                  </label>
                  {fields.length > 1 && (
                    <button onClick={() => removeField(field.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button variant="primary" size="sm" onClick={createForm}>
              <Zap className="w-3.5 h-3.5" />
              Créer le formulaire
            </Button>
          </div>
        </div>
      </Modal>

      {/* Preview modal */}
      {previewForm && (
        <Modal open={!!previewId} onClose={() => setPreviewId(null)} title={previewForm.name} size="md">
          <div className="space-y-3">
            {previewForm.description && (
              <p className="text-sm pb-3" style={{ color: 'rgba(255,255,255,0.45)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {previewForm.description}
              </p>
            )}
            {previewForm.fields.map(f => (
              <div key={f.id} className="space-y-1.5">
                <label className="text-xs font-semibold text-white/45 uppercase tracking-wider">
                  {f.label}{f.required && <span className="text-violet-400 ml-0.5">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea className="input-dark h-20" placeholder={f.placeholder} disabled />
                ) : f.type === 'select' ? (
                  <select className="input-dark" disabled>
                    <option>Sélectionner…</option>
                    {f.options?.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled className="rounded" />
                    <span className="text-sm text-white/50">{f.label}</span>
                  </div>
                ) : (
                  <input type={f.type} className="input-dark" placeholder={f.placeholder} disabled />
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </AppLayout>
  )
}
