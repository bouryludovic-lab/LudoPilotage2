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
    try {
      // ── Try server-side PIN check first (secure) ─────────────────────────
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, bootstrapToken: storage.getBootstrapToken() }),
      })
      const data = await res.json()

      if (data.ok && data.token) {
        storage.setToken(data.token)
        loadFromStorage()
        await syncAll()
        return { ok: true }
      }
      return { ok: false, error: data.error ?? 'PIN incorrect' }
    } catch {
      // ── Fallback: client-side check (no AIRTABLE_TOKEN env set) ──────────
      const bootstrapToken = storage.getBootstrapToken()
      if (!bootstrapToken) return { ok: false, error: 'Token de configuration manquant' }

      try {
        const records = await fetchProfilByBootstrapToken(bootstrapToken)
        if (!records.length) return { ok: false, error: 'Aucun profil trouvé dans Airtable' }

        const F = AT_FIELDS.profil
        for (const rec of records) {
          if (String(rec.fields[F.pin] ?? '') === pin) {
            const token = String(rec.fields[F.token] ?? '')
            if (!token) return { ok: false, error: 'Token Airtable non configuré' }
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
  }

  async function setupAccount(bootstrapToken: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const records = await fetchProfilByBootstrapToken(bootstrapToken)
      if (!records.length) return { ok: false, error: 'Token invalide ou aucun profil Airtable trouvé' }

      storage.setBootstrapToken(bootstrapToken)

      // Check if there's a PIN in Airtable
      const F = AT_FIELDS.profil
      const rec = records[0]
      const existingPin = String(rec.fields[F.pin] ?? '')

      if (!existingPin) {
        // No PIN set yet — use bootstrap token directly
        storage.setToken(bootstrapToken)
        loadFromStorage()
        await syncAll()
      }
      // If PIN exists, user will use checkPin flow

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
