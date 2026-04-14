'use client'

import { useRouter } from 'next/navigation'
import { storage } from '@/lib/storage'
import { useAppStore } from '@/store'

export function useAuth() {
  const router = useRouter()
  const { loadFromStorage } = useAppStore()

  const isLoggedIn = storage.isLoggedIn()

  async function checkPin(pin: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (data.ok) {
        storage.setToken(data.userEmail || pin)
        if (data.profil) {
          useAppStore.getState().setProfil(data.profil)
          storage.setProfil(data.profil)
        }
        loadFromStorage()
        return { ok: true }
      }
      return { ok: false, error: data.error ?? 'PIN incorrect' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' }
    }
  }

  function logout() {
    storage.logout()
    router.push('/login')
  }

  return { isLoggedIn, checkPin, logout }
}
