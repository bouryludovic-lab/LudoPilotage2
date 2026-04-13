'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { storage } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type Screen = 'pin' | 'setup'

export default function LoginPage() {
  const router  = useRouter()
  const { checkPin, setupAccount } = useAuth()

  const [screen,    setScreen]    = useState<Screen>('pin')
  const [pin,       setPin]       = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  // Setup fields
  const [token,     setToken]     = useState('')
  const [setupPin,  setSetupPin]  = useState('')
  const [setupError, setSetupError] = useState('')

  useEffect(() => {
    if (storage.isLoggedIn()) router.replace('/dashboard')
    const hasBootstrap = !!storage.getBootstrapToken()
    setScreen(hasBootstrap ? 'pin' : 'setup')
  }, [router])

  // ── PIN pad ──────────────────────────────────────────────────────────────────

  const pressPin = useCallback(async (key: string) => {
    if (loading) return
    setError('')

    if (key === 'back') {
      setPin(p => p.slice(0, -1))
      return
    }

    const next = key === 'ok' ? pin : pin.length < 4 ? pin + key : pin
    setPin(next)

    if ((key === 'ok' || next.length === 4) && next.length === 4) {
      setLoading(true)
      const result = await checkPin(next)
      setLoading(false)
      if (result.ok) {
        router.replace('/dashboard')
      } else {
        setError(result.error ?? 'PIN incorrect')
        setPin('')
      }
    }
  }, [pin, loading, checkPin, router])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (screen !== 'pin') return
      if (/^\d$/.test(e.key)) pressPin(e.key)
      if (e.key === 'Backspace') pressPin('back')
      if (e.key === 'Enter') pressPin('ok')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, pressPin])

  // ── Setup ────────────────────────────────────────────────────────────────────

  async function handleSetup() {
    setSetupError('')
    if (!token.startsWith('pat')) {
      setSetupError('Le token doit commencer par "pat"')
      return
    }
    setLoading(true)
    const result = await setupAccount(token, setupPin)
    setLoading(false)
    if (result.ok) {
      router.replace('/dashboard')
    } else {
      setSetupError(result.error ?? 'Configuration échouée')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="text-base font-bold text-white tracking-wider">THE NEXT STEP</div>
          <div className="text-[10px] text-white/40 tracking-[2px] mt-0.5">CONSULTING & STRATEGY</div>
          <p className="text-sm text-slate-500 mt-3">
            {screen === 'pin' ? 'Entrez votre PIN pour accéder' : 'Première connexion — configurez votre accès'}
          </p>
        </div>

        {/* ── PIN Screen ── */}
        {screen === 'pin' && (
          <div>
            {/* Dots */}
            <div className="flex gap-3 justify-center mb-8">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full transition-all duration-150',
                    i < pin.length ? 'bg-blue-500 scale-110' : 'bg-slate-700',
                  )}
                />
              ))}
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex justify-center mb-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-center text-xs text-red-400 mb-4 animate-slide-in">{error}</p>
            )}

            {/* Pad */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button key={d} onClick={() => pressPin(d)} className="pin-btn text-center">
                  {d}
                </button>
              ))}
              <button onClick={() => pressPin('back')} className="pin-btn text-xl">⌫</button>
              <button onClick={() => pressPin('0')} className="pin-btn text-center">0</button>
              <button
                onClick={() => pressPin('ok')}
                className="pin-btn bg-blue-600 border-blue-600 hover:bg-blue-700 text-center"
              >
                OK
              </button>
            </div>

            <button
              onClick={() => setScreen('setup')}
              className="w-full mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors text-center"
            >
              Première connexion / Reconfigurer
            </button>
          </div>
        )}

        {/* ── Setup Screen ── */}
        {screen === 'setup' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Token Airtable
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="patXXXXXXXXX.XXXXXXXXX"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              onClick={handleSetup}
              disabled={loading || !token}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Configurer et accéder
            </button>

            {setupError && (
              <p className="text-xs text-red-400 text-center">{setupError}</p>
            )}

            <button
              onClick={() => setScreen('pin')}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors text-center"
            >
              ← Retour au PIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
