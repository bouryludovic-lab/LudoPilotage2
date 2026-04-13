'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { InvoiceList } from '@/components/factures/InvoiceList'

export default function FacturesPage() {
  return (
    <AppLayout title="Factures" subtitle="Gérez et suivez toutes vos factures">
      <InvoiceList />
    </AppLayout>
  )
}
