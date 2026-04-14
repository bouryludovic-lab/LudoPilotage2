'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Plus, Trash2, Save, Eye, Palette, Building2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { storage } from '@/lib/storage'
import { useAppStore } from '@/store'
import { updateProfilInAirtable } from '@/lib/airtable'
import { ECHEANCE_OPTIONS, formatEur, uid } from '@/lib/utils'
import type { InvoiceTemplate, LineItem, InvoiceDesign } from '@/lib/types'
import { DEFAULT_DESIGN } from '@/lib/types'

interface LineRow extends LineItem { key: string }

function emptyLine(): LineRow {
  return { key: uid(), desc: '', qte: 1, pu: 0 }
}

// ─── Live header preview ──────────────────────────────────────────────────────
function InvoicePreview({ design, nom, logo }: { design: InvoiceDesign; nom: string; logo?: string }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: design.primaryColor }}>
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt="logo" className="w-10 h-10 object-contain rounded" />
          ) : (
            <div className="w-10 h-10 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ background: design.accentColor }}>
              {(nom || 'TNS').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-bold text-white uppercase">{nom || 'Votre entreprise'}</div>
            <div className="text-[10px]" style={{ color: 'rgba(148,163,184,0.9)' }}>{design.tagline}</div>
          </div>
        </div>
        <div className="px-4 py-2 rounded text-center" style={{ background: design.accentColor }}>
          <div className="text-[10px] font-bold text-white">FACTURE</div>
          <div className="text-[10px] font-bold text-white">2026-001</div>
        </div>
      </div>
      {/* Date row */}
      <div className="px-5 py-2 flex justify-between text-[10px]" style={{ background: '#f1f5f9', color: '#334155' }}>
        <span>Date : 14/04/2026</span>
        <span>Échéance : 30 jours</span>
        <span>Paiement : Virement</span>
      </div>
      {/* Table header */}
      <div className="px-5 py-1.5 flex justify-between text-[9px] font-bold text-white"
        style={{ background: design.primaryColor }}>
        <span>PRESTATION</span>
        <span>QTÉ &nbsp; P.U. HT &nbsp; TOTAL HT</span>
      </div>
      {/* Sample row */}
      <div className="px-5 py-1.5 flex justify-between text-[9px]" style={{ background: 'white', color: '#334155' }}>
        <span>Coaching stratégie — Juin 2026</span>
        <span>1 &nbsp;&nbsp; 1 500,00 € &nbsp;&nbsp; 1 500,00 €</span>
      </div>
      {/* Total */}
      <div className="px-5 py-1.5 text-[9px] font-bold text-white text-right"
        style={{ background: design.primaryColor }}>
        Total à payer &nbsp;&nbsp; 1 500,00 €
      </div>
    </div>
  )
}

// ─── Color picker row ─────────────────────────────────────────────────────────
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useRef(`cp-${uid()}`)
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        id={id.current}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0.5"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <div className="flex-1">
        <label htmlFor={id.current} className="block text-xs font-semibold mb-1"
          style={{ color: 'rgba(255,255,255,0.5)' }}>
          {label}
        </label>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: value, border: '1px solid rgba(255,255,255,0.15)' }} />
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.6)' }}>{value}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function DarkInput({ label, value, onChange, placeholder = '', hint = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
        {label}
      </label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input-dark w-full" />
      {hint && <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FactureTypePage() {
  const { profil, setProfil } = useAppStore()

  // Invoice template (default values)
  const [paiement,    setPaiement]    = useState('Virement bancaire')
  const [echeanceIdx, setEcheanceIdx] = useState(2)
  const [notes,       setNotes]       = useState('')
  const [lines,       setLines]       = useState<LineRow[]>([emptyLine()])

  // Invoice design
  const [design, setDesign] = useState<InvoiceDesign>({ ...DEFAULT_DESIGN })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Load template defaults
    const t = storage.getTemplate()
    setPaiement(t.paiement)
    setEcheanceIdx(t.echeanceIdx)
    setNotes(t.notes)
    setLines(t.lignes.length > 0 && t.lignes.some(l => l.desc || l.pu > 0)
      ? t.lignes.map(l => ({ ...l, key: uid() }))
      : [emptyLine()]
    )
    // Load design from profil
    if (profil.design) setDesign({ ...DEFAULT_DESIGN, ...profil.design })
  }, [profil.design])

  const setD = (k: keyof InvoiceDesign, v: string) =>
    setDesign(p => ({ ...p, [k]: v }))

  const updateLine = useCallback((key: string, field: keyof LineItem, value: string | number) => {
    setLines(prev => prev.map(l =>
      l.key === key ? { ...l, [field]: field === 'desc' ? value : Number(value) || 0 } : l
    ))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      // 1. Save template defaults to localStorage
      const template: InvoiceTemplate = {
        paiement,
        echeanceIdx,
        notes,
        lignes: lines.map(({ key, ...l }) => l),
      }
      storage.setTemplate(template)

      // 2. Save design into profil (localStorage + Airtable)
      const updatedProfil = { ...profil, design }
      setProfil(updatedProfil)
      if (profil.atId) {
        await updateProfilInAirtable(profil.atId, { design: JSON.stringify(design) as unknown as InvoiceDesign })
      }

      toast.success('Modèle enregistré ! Il sera appliqué à toutes les nouvelles factures.')
    } catch {
      toast.warning('Modèle sauvegardé localement — synchronisation Airtable échouée')
    } finally {
      setSaving(false)
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.qte * l.pu, 0)

  return (
    <AppLayout title="Modèle de facture" subtitle="Personnalisez le design et les valeurs par défaut de vos factures">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* ── Design section ─────────────────────────────────────────────── */}
        <Section icon={Palette} title="Design visuel">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-5">
              <ColorField label="Couleur principale (en-tête)" value={design.primaryColor}
                onChange={v => setD('primaryColor', v)} />
              <ColorField label="Couleur accentuée (badge, soulignements)" value={design.accentColor}
                onChange={v => setD('accentColor', v)} />
              <DarkInput label="Tagline entreprise" value={design.tagline} onChange={v => setD('tagline', v)}
                placeholder="CONSULTING & STRATEGY" />
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Aperçu en temps réel
              </p>
              <InvoicePreview design={design} nom={profil.nom} logo={profil.logo} />
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Le logo provient de <a href="/profil" className="text-violet-400 hover:underline">Mon profil</a>
              </p>
            </div>
          </div>
        </Section>

        {/* ── Bank details ───────────────────────────────────────────────── */}
        <Section icon={Building2} title="Coordonnées bancaires complètes">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Ces informations apparaissent dans la section BANK DETAILS au bas de chaque facture.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DarkInput label="Nom de la banque" value={design.bankName} onChange={v => setD('bankName', v)}
              placeholder="Caisse d'Epargne Bretagne-Pays de Loire" />
            <DarkInput label="BIC / SWIFT" value={design.bic} onChange={v => setD('bic', v)}
              placeholder="CEPAFRPP444" />
          </div>
          <DarkInput label="Titulaire du compte" value={design.titulaire} onChange={v => setD('titulaire', v)}
            placeholder="Boury Ludovic"
            hint="Laissez vide pour utiliser le nom de l'entreprise" />
          <DarkInput
            label="Détails RIB (Banque / Guichet / Compte / Clé)"
            value={design.bankDetails}
            onChange={v => setD('bankDetails', v)}
            placeholder="Banque : 14445 | Guichet : 20200 | Compte : 08005265409 | Clé RIB : 50"
          />
        </Section>

        {/* ── Default values ─────────────────────────────────────────────── */}
        <Section icon={FileText} title="Valeurs par défaut des nouvelles factures">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Mode de paiement
              </label>
              <select value={paiement} onChange={e => setPaiement(e.target.value)} className="input-dark w-full">
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
              <select value={String(echeanceIdx)} onChange={e => setEcheanceIdx(Number(e.target.value))}
                className="input-dark w-full">
                {ECHEANCE_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          {/* Default lignes */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Lignes de prestation pré-remplies
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_60px_96px_36px] gap-2 px-1">
                {['Description', 'Qté', 'Prix HT', ''].map((h, i) => (
                  <span key={i} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</span>
                ))}
              </div>
              {lines.map(line => (
                <div key={line.key} className="grid grid-cols-[1fr_60px_96px_36px] gap-2 items-end">
                  <input type="text" value={line.desc}
                    onChange={e => updateLine(line.key, 'desc', e.target.value)}
                    placeholder="Ex: Coaching stratégie" className="input-dark w-full" />
                  <input type="number" min={1} value={line.qte}
                    onChange={e => updateLine(line.key, 'qte', e.target.value)}
                    className="input-dark w-full text-center" />
                  <input type="number" min={0} step={0.01} value={line.pu || ''}
                    onChange={e => updateLine(line.key, 'pu', e.target.value)}
                    placeholder="0.00" className="input-dark w-full" />
                  <button onClick={() => lines.length > 1
                    ? setLines(p => p.filter(l => l.key !== line.key)) : undefined}
                    disabled={lines.length <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded-xl disabled:opacity-30"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={e => { if (lines.length > 1) (e.currentTarget as HTMLButtonElement).style.color = '#F87171' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={() => setLines(p => [...p, emptyLine()])}
                className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
                style={{ border: '1px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.35)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLButtonElement).style.color = '#A78BFA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)' }}>
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
              {subtotal > 0 && (
                <div className="rounded-xl p-3 flex justify-between"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total modèle (HT)</span>
                  <span className="text-sm font-bold text-violet-300 tabular-nums">{formatEur(subtotal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Default notes */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Notes / mentions légales par défaut
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Ex: TVA non applicable, article 293B du CGI"
              className="input-dark w-full resize-none" />
          </div>
        </Section>

        {/* ── Save button ────────────────────────────────────────────────── */}
        <div className="flex justify-end pb-8">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer le modèle'}
          </button>
        </div>

      </div>
    </AppLayout>
  )
}
