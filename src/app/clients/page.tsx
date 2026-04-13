'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { ClientList } from '@/components/clients/ClientList'

export default function ClientsPage() {
  return (
    <AppLayout title="Clients" subtitle="Gérez votre base de clients">
      <ClientList />
    </AppLayout>
  )
}
