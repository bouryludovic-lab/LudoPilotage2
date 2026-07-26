'use client'

import { useState, useEffect } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateInvoicePdf } from '@/lib/pdf'
import { useAppStore } from '@/store'
import type { Invoice } from '@/lib/types'

interface PdfModalProps {
  invoice: Invoice
  onClose: () => void
}

export function PdfModal({ invoice, onClose }: PdfModalProps) {
  const { profil } = useAppStore()
  const [pdfDataUri, setPdfDataUri]   = useState<string | null>(null)
  const [generating, setGenerating]   = useState(true)

  useEffect(() => {
    let cancelled = false
    setGenerating(true)
    generateInvoicePdf(invoice, profil)
      .then(uri => { if (!cancelled) { setPdfDataUri(uri); setGenerating(false) } })
      .catch(() => { if (!cancelled) { toast.error('Erreur lors de la génération du PDF'); setGenerating(false) } })
    return () => { cancelled = true }
  }, [invoice.id, profil]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDownload() {
    if (!pdfDataUri) return
    const a = document.createElement('a')
    a.href = pdfDataUri
    a.download = `facture-${invoice.num}.pdf`
    a.click()
    toast.success(`PDF ${invoice.num} téléchargé`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <span className="text-sm font-semibold text-white">{invoice.num} — {invoice.clientNom}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!pdfDataUri}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Télécharger
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {generating ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <span className="text-sm">Génération du PDF…</span>
          </div>
        ) : pdfDataUri ? (
          <iframe
            src={pdfDataUri}
            className="w-full max-w-3xl bg-white rounded-lg shadow-2xl"
            style={{ height: 'calc(100vh - 120px)' }}
            title={`Aperçu ${invoice.num}`}
          />
        ) : (
          <div className="text-slate-400 text-sm">Impossible de générer l&apos;aperçu</div>
        )}
      </div>
    </div>
  )
}
