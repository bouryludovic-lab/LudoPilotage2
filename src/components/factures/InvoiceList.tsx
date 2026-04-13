'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Send, FileText, Download, ChevronDown } from 'lucide-react'
import { StatusBadge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRow } from '@/components/ui/Spinner'
import { formatEur, formatDate, exportCSV } from '@/lib/utils'
import { deleteFacture, updateFactureStatut } from '@/lib/airtable'
import { useAppStore } from '@/store'
import type { Invoice, InvoiceStatus } from '@/lib/types'
import { SendInvoiceModal } from './SendInvoiceModal'
import { PdfModal } from './PdfModal'

const STATUSES: { value: InvoiceStatus | 'all'; label: string }[] = [
  { value: 'all',     label: 'Tous' },
  { value: 'draft',   label: 'Brouillons' },
  { value: 'pending', label: 'En attente' },
  { value: 'sent',    label: 'Envoyées' },
  { value: 'paid',    label: 'Payées' },
  { value: 'overdue', label: 'En retard' },
]

const NEXT_STATUSES: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  draft:   ['pending', 'sent'],
  pending: ['sent', 'paid', 'overdue'],
  sent:    ['paid', 'overdue'],
  paid:    [],
  overdue: ['paid'],
}

interface InvoiceListProps {
  loading?: boolean
}

export function InvoiceList({ loading }: InvoiceListProps) {
  const { factures, deleteFacture: localDelete, updateFacture } = useAppStore()
  const [filter, setFilter]       = useState<InvoiceStatus | 'all'>('all')
  const [search, setSearch]       = useState('')
  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [sendFac, setSendFac]     = useState<Invoice | null>(null)
  const [pdfFac, setPdfFac]       = useState<Invoice | null>(null)
  const [statusOpen, setStatusOpen] = useState<string | null>(null)

  const filtered = factures
    .filter(f => filter === 'all' || f.statut === filter)
    .filter(f => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        f.num.toLowerCase().includes(q) ||
        f.clientNom.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const fac = factures.find(f => f.id === deleteId)
    try {
      if (fac?.atId) await deleteFacture(fac.atId)
      localDelete(deleteId)
      toast.success('Facture supprimée')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  async function handleChangeStatus(fac: Invoice, newStatus: InvoiceStatus) {
    // Optimistic update
    updateFacture(fac.id, { statut: newStatus })
    setStatusOpen(null)
    try {
      if (fac.atId) await updateFactureStatut(fac.atId, newStatus)
      toast.success(`Statut mis à jour → ${newStatus}`)
    } catch {
      // Rollback
      updateFacture(fac.id, { statut: fac.statut })
      toast.error('Erreur mise à jour du statut')
    }
  }

  function handleExportCSV() {
    const rows = [
      ['N°', 'Client', 'Date', 'Échéance', 'Montant', 'Statut'],
      ...filtered.map(f => [f.num, f.clientNom, formatDate(f.date), formatDate(f.echeance), String(f.total), f.statut]),
    ]
    exportCSV(rows, `factures-${new Date().toISOString().split('T')[0]}.csv`)
    toast.success('Export CSV téléchargé')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 w-48"
          />
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">N° Facture</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Échéance</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Montant</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={FileText}
                      title="Aucune facture"
                      description={search ? 'Aucun résultat pour cette recherche.' : 'Créez votre première facture.'}
                    />
                  </td>
                </tr>
              )}

              {!loading && filtered.map((fac, i) => {
                const nexts = NEXT_STATUSES[fac.statut] ?? []
                return (
                  <tr key={fac.id} className={`hover:bg-slate-50 transition-colors ${i < filtered.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">{fac.num}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{fac.clientNom}</div>
                      {fac.clientEmail && <div className="text-xs text-slate-400">{fac.clientEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDate(fac.date)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{formatDate(fac.echeance)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right tabular-nums">{formatEur(fac.total)}</td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() => setStatusOpen(statusOpen === fac.id ? null : fac.id)}
                          className="flex items-center gap-1 group"
                        >
                          <StatusBadge status={fac.statut} />
                          {nexts.length > 0 && (
                            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                          )}
                        </button>
                        {statusOpen === fac.id && nexts.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[140px] py-1">
                            {nexts.map(ns => (
                              <button
                                key={ns}
                                onClick={() => handleChangeStatus(fac, ns)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                              >
                                Marquer comme → <span className="font-medium">{ns}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setPdfFac(fac)}
                          title="Aperçu PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSendFac(fac)}
                          title="Envoyer par email"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(fac.id)}
                          title="Supprimer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400 text-right">
          {filtered.length} facture{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer la facture"
        message="Cette action est irréversible. La facture sera supprimée localement et dans Airtable."
        confirmLabel="Supprimer"
        danger
        loading={deleting}
      />

      {/* Send modal */}
      {sendFac && (
        <SendInvoiceModal
          invoice={sendFac}
          onClose={() => setSendFac(null)}
        />
      )}

      {/* PDF modal */}
      {pdfFac && (
        <PdfModal
          invoice={pdfFac}
          onClose={() => setPdfFac(null)}
        />
      )}
    </div>
  )
}
