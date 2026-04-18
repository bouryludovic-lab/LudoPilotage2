'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'
import { Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { createFacture } from '@/lib/airtable'
import { storage } from '@/lib/storage'
import { generateInvoiceNum, addDays, ECHEANCE_OPTIONS, formatEur, uid } from '@/lib/utils'
import type { Invoice, LineItem } from '@/lib/types'

interface LineItemRow extends LineItem {
  key: string
}

function emptyLine(): LineItemRow {
  return { key: uid(), desc: '', qte: 1, pu: 0 }
}

const CARD = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const SECTION_TITLE = {
  color: 'rgba(255,255,255,0.6)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

export function InvoiceForm() {
  const router   = useRouter()
  const { factures, clients, profil, addFacture } = useAppStore()

  const today = new Date().toISOString().split('T')[0]

  // Load template defaults on mount
  const [clientId,      setClientId]      = useState('')
  const [date,          setDate]          = useState(today)
  const [echeanceIdx,   setEcheanceIdx]   = useState(2)
  const [paiement,      setPaiement]      = useState('Virement bancaire')
  const [notes,         setNotes]         = useState('')
  const [lines,         setLines]         = useState<LineItemRow[]>([emptyLine()])
  const [saving,        setSaving]        = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const [templateLoaded, setTemplateLoaded] = useState(false)

  useEffect(() => {
    if (templateLoaded) return
    const t = storage.getTemplate()
    setEcheanceIdx(t.echeanceIdx)
    setPaiement(t.paiement)
    setNotes(t.notes)
    if (t.lignes.length > 0 && t.lignes.some(l => l.desc || l.pu > 0)) {
      setLines(t.lignes.map(l => ({ ...l, key: uid() })))
    }
    setTemplateLoaded(true)
  }, [templateLoaded])

  const selectedClient = clients.find(c => c.id === clientId)
  const echeanceOpt    = ECHEANCE_OPTIONS[echeanceIdx]
  const echeanceDate   = addDays(date, echeanceOpt.days)

  const subtotal = lines.reduce((s, l) => s + (l.qte * l.pu), 0)

  // ── Line management ──────────────────────────────────────────────────────────

  const updateLine = useCallback((key: string, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: field === 'desc' ? value : Number(value) || 0 } : l))
  }, [])

  const removeLine = useCallback((key: string) => {
    setLines(prev => prev.filter(l => l.key !== key))
  }, [])

  // ── Validation ────────────────────────────────────────────────────────────────

  function validate() {
    const errs: Record<string, string> = {}
    if (!clientId)                     errs.client  = 'Client requis'
    if (!date)                         errs.date    = 'Date requise'
    if (lines.every(l => !l.desc))     errs.lines   = 'Au moins une ligne de prestation requise'
    if (lines.some(l => l.desc && l.pu <= 0)) errs.lines = 'Le prix unitaire doit être supérieur à 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async function handleSave(statut: 'draft' | 'pending') {
    if (!validate()) return
    setSaving(true)

    const num = generateInvoiceNum(profil.prefix || 'F-', factures.map(f => f.num))
    const validLines = lines.filter(l => l.desc && l.pu > 0)

    const invoice: Invoice = {
      id:           uid(),
      num,
      date,
      echeance:     echeanceDate,
      echeanceLabel: echeanceOpt.label,
      clientId:     selectedClient?.id ?? '',
      clientNom:    selectedClient?.nom ?? '',
      clientEmail:  selectedClient?.email ?? '',
      clientAdresse: selectedClient?.adresse ?? '',
      clientSiret:  selectedClient?.siret ?? '',
      paiement,
      iban:         profil.iban,
      notes,
      lignes:       validLines.map(({ key, ...l }) => l),
      total:        subtotal,
      statut,
    }

    try {
      const atId = await createFacture(invoice)
      if (atId) invoice.atId = atId
      addFacture(invoice)
      toast.success(`Facture ${num} créée`)
      router.push('/factures')
    } catch {
      addFacture(invoice)
      toast.warning('Facture sauvegardée localement (sync Airtable échouée)')
      router.push('/factures')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Client & Date */}
      <div className="rounded-2xl p-5" style={CARD}>
        <h2 className="text-sm font-semibold mb-4 pb-3" style={SECTION_TITLE}>Informations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Client select */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Client <span className="text-violet-400">*</span>
            </label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="input-dark w-full"
              style={errors.client ? { borderColor: 'rgba(248,113,113,0.6)' } : {}}
            >
              <option value="">Sélectionner un client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            {errors.client && <p className="mt-1 text-xs text-red-400">{errors.client}</p>}
          </div>

          {selectedClient ? (
            <div className="rounded-xl p-3 text-xs self-end"
              style={{ background: 'rgba(59,107,232,0.08)', border: '1px solid rgba(59,107,232,0.12)' }}>
              <div className="font-semibold mb-0.5 text-violet-300">{selectedClient.nom}</div>
              {selectedClient.email   && <div style={{ color: 'rgba(255,255,255,0.5)' }}>{selectedClient.email}</div>}
              {selectedClient.adresse && <div className="truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{selectedClient.adresse}</div>}
            </div>
          ) : <div />}

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Date de facturation <span className="text-violet-400">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input-dark w-full"
              style={errors.date ? { borderColor: 'rgba(248,113,113,0.6)' } : {}}
            />
            {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date}</p>}
          </div>

          {/* Echeance */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Échéance de paiement
            </label>
            <select
              value={String(echeanceIdx)}
              onChange={e => setEcheanceIdx(Number(e.target.value))}
              className="input-dark w-full"
            >
              {ECHEANCE_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Paiement */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Mode de paiement
            </label>
            <select
              value={paiement}
              onChange={e => setPaiement(e.target.value)}
              className="input-dark w-full"
            >
              <option>Virement bancaire</option>
              <option>Chèque</option>
              <option>Espèces</option>
              <option>Carte bancaire</option>
              <option>PayPal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-2xl p-5" style={CARD}>
        <h2 className="text-sm font-semibold mb-4 pb-3" style={SECTION_TITLE}>Prestations</h2>

        {errors.lines && (
          <p className="text-xs text-red-400 mb-3">{errors.lines}</p>
        )}

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_72px_110px_36px] gap-2 px-1">
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Description</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Qté</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>Prix unit. HT</span>
            <span />
          </div>

          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_72px_110px_36px] gap-2 items-end">
              <input
                type="text"
                value={line.desc}
                onChange={e => updateLine(line.key, 'desc', e.target.value)}
                placeholder="Description de la prestation"
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
                onClick={() => lines.length > 1 ? removeLine(line.key) : undefined}
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
            onClick={() => setLines(prev => [...prev, emptyLine()])}
            className="w-full py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 mt-2"
            style={{ border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(59,107,232,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = '#7AAAFF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
        </div>

        {/* Total */}
        <div className="mt-4 rounded-xl p-3.5 space-y-1.5"
          style={{ background: 'rgba(59,107,232,0.06)', border: '1px solid rgba(59,107,232,0.1)' }}>
          <div className="flex justify-between text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <span>Sous-total HT</span>
            <span className="font-medium tabular-nums">{formatEur(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span>TVA</span>
            <span>Non applicable (auto-entrepreneur)</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'white' }}>
            <span>Total TTC</span>
            <span className="text-violet-300 tabular-nums">{formatEur(subtotal)}</span>
          </div>
        </div>

        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
          TVA non applicable, article 293B du CGI
        </p>
      </div>

      {/* Notes */}
      <div className="rounded-2xl p-5" style={CARD}>
        <h2 className="text-sm font-semibold mb-3 pb-3" style={SECTION_TITLE}>Notes / mentions légales</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes additionnelles pour le client…"
          rows={3}
          className="input-dark w-full resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="secondary" onClick={() => router.back()} disabled={saving}>
          Annuler
        </Button>
        <Button variant="ghost" onClick={() => handleSave('draft')} loading={saving}>
          <Save className="w-3.5 h-3.5" /> Brouillon
        </Button>
        <Button variant="primary" onClick={() => handleSave('pending')} loading={saving}>
          Créer la facture
        </Button>
      </div>
    </div>
  )
}
