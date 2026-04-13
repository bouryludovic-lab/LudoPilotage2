'use client'

import { useRouter } from 'next/navigation'
import { storage } from '@/lib/storage'
import { fetchProfilByBootstrapToken } from '@/lib/airtable'
import { AT_FIELDS } from '@/lib/types'
import { useAppStore } from '@/store'

export function useAuth() {
  const router = useRouter()
  const { syncAll, loadFromStorage } = useAppStore()

  const isLoggedIn = storage.isLoggedIn()

  async function checkPin(pin: string): Promise<{ ok: boolean; error?: string }> {
    const bootstrapToken = storage.getBootstrapToken()
    if (!bootstrapToken) return { ok: false, error: 'Token de configuration manquant' }

    try {
      const records = await fetchProfilByBootstrapToken(bootstrapToken)
      if (!records.length) return { ok: false, error: 'Aucun profil trouvé dans Airtable' }

      const F = AT_FIELDS.profil
      for (const rec of records) {
        const storedPin = String(rec.fields[F.pin] ?? '')
        if (storedPin === pin) {
          const token = String(rec.fields[F.token] ?? '')
          if (!token) return { ok: false, error: 'Token Airtable non configuré dans le profil' }
          storage.setToken(token)
          loadFromStorage()
          await syncAll()
          return { ok: true }
        }
      }
      return { ok: false, error: 'PIN incorrect' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' }
    }
  }

  async function setupAccount(bootstrapToken: string, pin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const records = await fetchProfilByBootstrapToken(bootstrapToken)
      if (!records.length) return { ok: false, error: 'Token invalide ou aucun profil Airtable trouvé' }

      const F = AT_FIELDS.profil
      const rec = records[0]
      const existingPin = String(rec.fields[F.pin] ?? '')

      // If a PIN already exists and user is setting up, we store the bootstrap token
      // and they'll use checkPin flow. If no PIN yet, store the token as auth token.
      storage.setBootstrapToken(bootstrapToken)

      if (!existingPin) {
        // First time: use the bootstrap token as the working token
        storage.setToken(bootstrapToken)
      }

      loadFromStorage()
      await syncAll()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Token invalide' }
    }
  }

  function logout() {
    storage.logout()
    router.push('/login')
  }

  return { isLoggedIn, checkPin, setupAccount, logout }
}
