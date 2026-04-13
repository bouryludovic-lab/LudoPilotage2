'use client'

import { useState, useEffect } from 'react'
import { Download, Upload, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { generateInvoicePdf, generatePdfBase64 } from '@/lib/pdf'
import { uploadPdfToGitHub, updateFacturePdfUrl } from '@/lib/airtable'
import { useAppStore } from '@/store'
import type { Invoice } from '@/lib/types'

interface PdfModalProps {
  invoice: Invoice
  onClose: () => void
}

export function PdfModal({ invoice, onClose }: PdfModalProps) {
  const { profil, config, updateFacture } = useAppStore()
  const [pdfDataUri, setPdfDataUri]   = useState<string | null>(null)
  const [generating, setGenerating]   = useState(true)
  const [uploading, setUploading]     = useState(false)

  useEffect(() => {
    let cancelled = false
    setGenerating(true)
    generateInvoicePdf(invoice, profil)
      .then(uri => { if (!cancelled) { setPdfDataUri(uri); setGenerating(false) } })
      .catch(() => { if (!cancelled) { toast.error('Erreur lors de la génération du PDF'); setGenerating(false) } })
    return () => { cancelled = true }
  }, [invoice.id, profil])

  function handleDownload() {
    if (!pdfDataUri) return
    const a = document.createElement('a')
    a.href = pdfDataUri
    a.download = `${invoice.num}.pdf`
    a.click()
    toast.success(`PDF ${invoice.num} téléchargé`)
  }

  async function handleUploadGitHub() {
    if (!pdfDataUri) return
    if (!config.ghToken) {
      toast.error('Token GitHub non configuré dans les paramètres')
      return
    }
    setUploading(true)
    try {
      const base64 = pdfDataUri.split('base64,')[1] ?? ''
      const url = await uploadPdfToGitHub(`${invoice.num}.pdf`, base64, config.ghToken)

      // Update invoice with PDF URL
      updateFacture(invoice.id, { pdfUrl: url, statut: invoice.statut === 'draft' ? 'pending' : invoice.statut })
      if (invoice.atId) await updateFacturePdfUrl(invoice.atId, url)

      toast.success('PDF uploadé et lien sauvegardé !')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur upload GitHub')
    } finally {
      setUploading(false)
    }
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
            onClick={handleUploadGitHub}
            disabled={!pdfDataUri || uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Uploader GitHub
          </button>
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
          <div className="text-slate-400 text-sm">Impossible de générer l'aperçu</div>
        )}
      </div>
    </div>
  )
}
