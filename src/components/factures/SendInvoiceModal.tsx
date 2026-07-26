'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Paperclip } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { sendViaWebhook, markFactureSent } from '@/lib/airtable'
import { generatePdfBase64 } from '@/lib/pdf'
import { storage } from '@/lib/storage'
import { useAppStore } from '@/store'
import type { Invoice } from '@/lib/types'
import { formatEur, formatDate } from '@/lib/utils'

interface SendInvoiceModalProps {
  invoice: Invoice
  onClose: () => void
}

export function SendInvoiceModal({ invoice, onClose }: SendInvoiceModalProps) {
  const { config, profil, updateFacture } = useAppStore()
  const [email, setEmail]     = useState(invoice.clientEmail)
  const [sending, setSending] = useState(false)

  const gmailTokens    = typeof window !== 'undefined' ? storage.getGmailTokens() : null
  const gmailConnected = !!gmailTokens?.refreshToken

  async function sendViaGmail(pdfBase64: string) {
    const tokens = storage.getGmailTokens()
    if (!tokens) throw new Error('Gmail non connecté')

    const res = await fetch('/api/gmail/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:      email,
        subject: `Facture ${invoice.num} — ${profil.nom || 'The Next Step'}`,
        body: [
          'Bonjour,',
          '',
          `Veuillez trouver ci-joint la facture ${invoice.num} d'un montant de ${formatEur(invoice.total)}.`,
          `Échéance : ${invoice.echeanceLabel || formatDate(invoice.echeance)}.`,
          '',
          'Cordialement,',
          profil.nom || '',
        ].join('\n'),
        attachments: [{
          name:   `facture-${invoice.num}.pdf`,
          type:   'application/pdf',
          base64: pdfBase64,
        }],
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Erreur envoi Gmail')
    if (data.newAccessToken) {
      storage.setGmailTokens({ ...tokens, accessToken: data.newAccessToken, expiresAt: data.newExpiresAt })
    }
  }

  async function handleSend() {
    if (!email) { toast.error('Email requis'); return }
    if (!gmailConnected && !config.webhook) {
      toast.error('Connectez Gmail ou configurez le webhook Make dans Configuration')
      return
    }

    setSending(true)
    try {
      // The PDF is generated fresh from the invoice data — nothing is stored anywhere
      const pdfBase64 = await generatePdfBase64(invoice, profil)

      if (gmailConnected) {
        await sendViaGmail(pdfBase64)
      } else {
        await sendViaWebhook(config.webhook!, {
          action:      'send_invoice',
          num:         invoice.num,
          client:      invoice.clientNom,
          email,
          montant:     formatEur(invoice.total),
          date:        formatDate(invoice.date),
          echeance:    formatDate(invoice.echeance),
          pdfFilename: `facture-${invoice.num}.pdf`,
          pdfBase64,
        })
      }

      updateFacture(invoice.id, {
        statut:      'sent',
        emailEnvoye: true,
        dateEnvoi:   new Date().toISOString().split('T')[0],
      })
      if (invoice.atId) {
        try { await markFactureSent(invoice.atId) } catch { /* sync will catch up */ }
      }

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

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Paperclip className="w-3.5 h-3.5" />
          <span>
            Le PDF <strong>facture-{invoice.num}.pdf</strong> sera joint à l&apos;email
            {gmailConnected ? ' (envoi via Gmail)' : ' (envoi via Make)'}
          </span>
        </div>

        {!gmailConnected && !config.webhook && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ Aucun canal d&apos;envoi configuré. Connectez <strong>Gmail</strong> ou ajoutez le
            webhook <strong>Make</strong> dans la page Configuration.
          </div>
        )}
      </div>
    </Modal>
  )
}
