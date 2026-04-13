'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { InvoiceForm } from '@/components/factures/InvoiceForm'

export default function NouvellePage() {
  return (
    <AppLayout title="Nouvelle facture" subtitle="Créez et envoyez une nouvelle facture">
      <InvoiceForm />
    </AppLayout>
  )
}
