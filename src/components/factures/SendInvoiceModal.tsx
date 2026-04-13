'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { sendViaWebhook, uploadPdfToGitHub, updateFacturePdfUrl } from '@/lib/airtable'
import { useAppStore } from '@/store'
import type { Invoice } from '@/lib/types'
import { formatEur, formatDate } from '@/lib/utils'

interface SendInvoiceModalProps {
  invoice: Invoice
  onClose: () => void
}

export function SendInvoiceModal({ invoice, onClose }: SendInvoiceModalProps) {
  const { config, updateFacture } = useAppStore()
  const [email, setEmail]     = useState(invoice.clientEmail)
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!email) { toast.error('Email requis'); return }
    if (!config.webhook) { toast.error('Webhook Make non configuré dans les paramètres'); return }

    setSending(true)
    try {
      const payload = {
        action:   'send_invoice',
        num:      invoice.num,
        client:   invoice.clientNom,
        email,
        montant:  formatEur(invoice.total),
        date:     formatDate(invoice.date),
        echeance: formatDate(invoice.echeance),
        pdfUrl:   invoice.pdfUrl ?? '',
      }

      await sendViaWebhook(config.webhook, payload)

      updateFacture(invoice.id, {
        statut:      'sent',
        emailEnvoye: true,
        dateEnvoi:   new Date().toISOString().split('T')[0],
      })

      toast.success('Facture envoyée avec succès !')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Envoyer la facture ${invoice.num}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button variant="primary" onClick={handleSend} loading={sending}>
            Envoyer par email
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Client</span>
            <span className="font-medium text-slate-900">{invoice.clientNom}</span>
          </div>
          <div className="flex justify-between text-slate-600 mb-1">
            <span>Montant</span>
            <span className="font-semibold text-slate-900">{formatEur(invoice.total)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Échéance</span>
            <span className="text-slate-900">{formatDate(invoice.echeance)}</span>
          </div>
        </div>

        <Input
          label="Adresse email destinataire"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="client@exemple.fr"
          required
        />

        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline block"
          >
            Voir le PDF généré →
          </a>
        )}

        {!config.webhook && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ Le webhook Make n'est pas configuré. Rendez-vous dans <strong>Configuration</strong> pour l'ajouter.
          </div>
        )}
      </div>
    </Modal>
  )
}
