'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { createFacture } from '@/lib/airtable'
import { generateInvoiceNum, addDays, ECHEANCE_OPTIONS, formatEur, uid } from '@/lib/utils'
import type { Invoice, LineItem } from '@/lib/types'

interface LineItemRow extends LineItem {
  key: string
}

function emptyLine(): LineItemRow {
  return { key: uid(), desc: '', qte: 1, pu: 0 }
}

export function InvoiceForm() {
  const router   = useRouter()
  const { factures, clients, profil, addFacture } = useAppStore()

  const today = new Date().toISOString().split('T')[0]

  const [clientId,      setClientId]      = useState('')
  const [date,          setDate]          = useState(today)
  const [echeanceIdx,   setEcheanceIdx]   = useState(2) // 30 jours
  const [paiement,      setPaiement]      = useState('Virement bancaire')
  const [notes,         setNotes]         = useState('')
  const [lines,         setLines]         = useState<LineItemRow[]>([emptyLine()])
  const [saving,        setSaving]        = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})

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
    } catch (e) {
      // Save locally even if Airtable fails
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
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-100">Informations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Client"
            required
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            error={errors.client}
          >
            <option value="">Sélectionner un client…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </Select>

          {selectedClient && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 self-end">
              <div className="font-medium text-slate-800 mb-0.5">{selectedClient.nom}</div>
              {selectedClient.email   && <div>{selectedClient.email}</div>}
              {selectedClient.adresse && <div className="truncate">{selectedClient.adresse}</div>}
            </div>
          )}

          <Input
            label="Date de facturation"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            error={errors.date}
          />

          <Select
            label="Échéance de paiement"
            value={String(echeanceIdx)}
            onChange={e => setEcheanceIdx(Number(e.target.value))}
          >
            {ECHEANCE_OPTIONS.map((opt, i) => (
              <option key={i} value={i}>{opt.label}</option>
            ))}
          </Select>

          <Select
            label="Mode de paiement"
            value={paiement}
            onChange={e => setPaiement(e.target.value)}
          >
            <option>Virement bancaire</option>
            <option>Chèque</option>
            <option>Espèces</option>
            <option>Carte bancaire</option>
            <option>PayPal</option>
          </Select>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-100">Prestations</h2>

        {errors.lines && (
          <p className="text-xs text-red-500 mb-3">{errors.lines}</p>
        )}

        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[1fr_72px_110px_36px] gap-2 px-1">
            <span className="text-xs font-medium text-slate-500">Description</span>
            <span className="text-xs font-medium text-slate-500">Qté</span>
            <span className="text-xs font-medium text-slate-500">Prix unit. HT</span>
            <span />
          </div>

          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_72px_110px_36px] gap-2 items-end">
              <input
                type="text"
                value={line.desc}
                onChange={e => updateLine(line.key, 'desc', e.target.value)}
                placeholder="Description de la prestation"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-sm"
              />
              <input
                type="number"
                min={1}
                value={line.qte}
                onChange={e => updateLine(line.key, 'qte', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-[13px] bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-sm text-center"
              />
              <input
                type="number"
                min={0}
                step={0.01}
                value={line.pu || ''}
                onChange={e => updateLine(line.key, 'pu', e.target.value)}
                placeholder="0.00"
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-[13px] bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-sm"
              />
              <button
                onClick={() => lines.length > 1 ? removeLine(line.key) : undefined}
                disabled={lines.length <= 1}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <button
            onClick={() => setLines(prev => [...prev, emptyLine()])}
            className="w-full py-2.5 border border-dashed border-slate-300 rounded-lg text-[13px] text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
        </div>

        {/* Totaux */}
        <div className="mt-4 bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Sous-total HT</span>
            <span className="font-medium tabular-nums">{formatEur(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>TVA</span>
            <span>Non applicable (auto-entrepreneur)</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900 pt-2 mt-1 border-t border-slate-200">
            <span>Total TTC</span>
            <span className="text-blue-600 tabular-nums">{formatEur(subtotal)}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-2">
          TVA non applicable, article 293B du CGI
        </p>
      </div>

      {/* Notes */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
        <Textarea
          label="Notes / mentions légales"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes additionnelles pour le client…"
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
