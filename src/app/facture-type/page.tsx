'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Save, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { storage } from '@/lib/storage'
import { ECHEANCE_OPTIONS, formatEur, uid } from '@/lib/utils'
import type { InvoiceTemplate, LineItem } from '@/lib/types'

interface LineRow extends LineItem { key: string }

function emptyLine(): LineRow {
  return { key: uid(), desc: '', qte: 1, pu: 0 }
}

export default function FactureTypePage() {
  const [paiement,    setPaiement]    = useState('Virement bancaire')
  const [echeanceIdx, setEcheanceIdx] = useState(2)
  const [notes,       setNotes]       = useState('')
  const [lines,       setLines]       = useState<LineRow[]>([emptyLine()])
  const [saved,       setSaved]       = useState(false)

  // Load existing template on mount
  useEffect(() => {
    const t = storage.getTemplate()
    setPaiement(t.paiement)
    setEcheanceIdx(t.echeanceIdx)
    setNotes(t.notes)
    setLines(t.lignes.length > 0
      ? t.lignes.map(l => ({ ...l, key: uid() }))
      : [emptyLine()]
    )
  }, [])

  const updateLine = useCallback((key: string, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map(l =>
      l.key === key ? { ...l, [field]: field === 'desc' ? value : Number(value) || 0 } : l
    ))
    setSaved(false)
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines(prev => prev.length > 1 ? prev.filter(l => l.key !== key) : prev)
    setSaved(false)
  }, [])

  function handleSave() {
    const template: InvoiceTemplate = {
      paiement,
      echeanceIdx,
      notes,
      lignes: lines.map(({ key, ...l }) => l),
    }
    storage.setTemplate(template)
    setSaved(true)
    toast.success('Modèle de facture enregistré ! Il sera appliqué à toutes les nouvelles factures.')
  }

  const subtotal = lines.reduce((s, l) => s + l.qte * l.pu, 0)

  return (
    <AppLayout
      title="Modèle de facture"
      subtitle="Configurez les valeurs par défaut appliquées à chaque nouvelle facture"
    >
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Info banner */}
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <FileText className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Ce modèle pré-remplit automatiquement le mode de paiement, l'échéance, les notes
            et les lignes de prestation lors de la création d'une nouvelle facture.
            Vous pourrez toujours modifier ces valeurs avant d'enregistrer.
          </p>
        </div>

        {/* Defaults */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold pb-3" style={{ color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            Paramètres par défaut
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Mode de paiement
              </label>
              <select
                value={paiement}
                onChange={e => { setPaiement(e.target.value); setSaved(false) }}
                className="input-dark w-full"
              >
                <option>Virement bancaire</option>
                <option>Chèque</option>
                <option>Espèces</option>
                <option>Carte bancaire</option>
                <option>PayPal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Échéance de paiement
              </label>
              <select
                value={String(echeanceIdx)}
                onChange={e => { setEcheanceIdx(Number(e.target.value)); setSaved(false) }}
                className="input-dark w-full"
              >
                {ECHEANCE_OPTIONS.map((opt, i) => (
                  <option key={i} value={i}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Default line items */}
        <div className="rounded-2xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold pb-3" style={{ color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            Lignes de prestation par défaut
          </h2>

          {/* Header */}
          <div className="grid grid-cols-[1fr_64px_100px_36px] gap-2 px-1">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Description</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Qté</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Prix HT</span>
            <span />
          </div>

          {lines.map(line => (
            <div key={line.key} className="grid grid-cols-[1fr_64px_100px_36px] gap-2 items-end">
              <input
                type="text"
                value={line.desc}
                onChange={e => updateLine(line.key, 'desc', e.target.value)}
                placeholder="Ex: Coaching stratégie"
                className="input-dark w-full"
              />
              <input
                type="number"
                min={1}
                value={line.qte}
                onChange={e => updateLine(line.key, 'qte', e.target.value)}
                className="input-dark w-full text-center"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={line.pu || ''}
                onChange={e => updateLine(line.key, 'pu', e.target.value)}
                placeholder="0.00"
                className="input-dark w-full"
              />
              <button
                onClick={() => removeLine(line.key)}
                disabled={lines.length <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { if (lines.length > 1) (e.currentTarget as HTMLButtonElement).style.color = '#F87171' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={() => { setLines(prev => [...prev, emptyLine()]); setSaved(false) }}
            className="w-full py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
            style={{ border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#A78BFA' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>

          {subtotal > 0 && (
            <div className="rounded-xl p-3.5 flex justify-between items-center mt-2"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total modèle (HT)</span>
              <span className="text-sm font-bold text-violet-300 tabular-nums">{formatEur(subtotal)}</span>
            </div>
          )}
        </div>

        {/* Default notes */}
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold mb-4 pb-3" style={{ color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            Notes / mentions légales par défaut
          </h2>
          <textarea
            value={notes}
            onChange={e => { setNotes(e.target.value); setSaved(false) }}
            placeholder="Ex: TVA non applicable, article 293B du CGI&#10;Paiement à réception de facture…"
            rows={4}
            className="input-dark w-full resize-none"
          />
        </div>

        {/* Save */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: saved ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              border: saved ? '1px solid rgba(16,185,129,0.4)' : 'none',
              color: saved ? '#6EE7B7' : 'white' }}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Modèle enregistré ✓' : 'Enregistrer le modèle'}
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
