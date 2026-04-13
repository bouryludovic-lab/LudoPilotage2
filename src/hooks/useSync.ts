'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'

export function useSync() {
  const { syncAll, syncing, syncError, lastSyncAt } = useAppStore()

  const sync = useCallback(async () => {
    try {
      await syncAll()
      toast.success('Données synchronisées')
    } catch {
      toast.error('Erreur de synchronisation avec Airtable')
    }
  }, [syncAll])

  return { sync, syncing, syncError, lastSyncAt }
}
