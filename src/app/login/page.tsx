'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Settings } from 'lucide-react'
import { storage } from '@/lib/storage'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const { checkPin, setupAccount } = useAuth()

  const [pin,        setPin]        = useState('')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  // Admin setup — hidden, accessible via double-click on the logo
  const [showSetup,  setShowSetup]  = useState(false)
  const [token,      setToken]      = useState('')
  const [setupError, setSetupError] = useState('')
  const [logoClicks, setLogoClicks] = useState(0)

  useEffect(() => {
    if (storage.isLoggedIn()) router.replace('/dashboard')
  }, [router])

  // Secret: 5 clicks on logo reveals setup
  function handleLogoClick() {
    const next = logoClicks + 1
    setLogoClicks(next)
    if (next >= 5) { setShowSetup(true); setLogoClicks(0) }
  }

  // ── PIN pad ──────────────────────────────────────────────────────────────────

  const pressPin = useCallback(async (key: string) => {
    if (loading || showSetup) return
    setError('')

    if (key === 'back') {
      setPin(p => p.slice(0, -1))
      return
    }

    const next = key === 'ok' ? pin : pin.length < 4 ? pin + key : pin
    setPin(next)

    if (next.length === 4) {
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
  }, [pin, loading, showSetup, checkPin, router])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showSetup) return
      if (/^\d$/.test(e.key)) pressPin(e.key)
      if (e.key === 'Backspace') pressPin('back')
      if (e.key === 'Enter') pressPin('ok')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSetup, pressPin])

  // ── Admin setup ───────────────────────────────────────────────────────────────

  async function handleSetup() {
    setSetupError('')
    if (!token.startsWith('pat')) {
      setSetupError('Le token doit commencer par "pat"')
      return
    }
    setLoading(true)
    const result = await setupAccount(token)
    setLoading(false)
    if (result.ok) {
      setShowSetup(false)
      setToken('')
      if (storage.isLoggedIn()) router.replace('/dashboard')
      // else: user will now enter PIN
    } else {
      setSetupError(result.error ?? 'Configuration échouée')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <div
            className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 cursor-pointer select-none active:scale-95 transition-transform"
            onClick={handleLogoClick}
            title=""
          >
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div className="text-base font-bold text-white tracking-wider">THE NEXT STEP</div>
          <div className="text-[10px] text-white/40 tracking-[2px] mt-0.5">CONSULTING & STRATEGY</div>
          <p className="text-sm text-slate-500 mt-4">
            Entrez votre PIN pour accéder
          </p>
        </div>

        {/* ── PIN pad ── */}
        {!showSetup && (
          <div>
            {/* Dots */}
            <div className="flex gap-4 justify-center mb-8">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'w-4 h-4 rounded-full transition-all duration-150',
                    i < pin.length ? 'bg-blue-500 scale-110' : 'bg-slate-700',
                  )}
                />
              ))}
            </div>

            {loading && (
              <div className="flex justify-center mb-5">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            )}

            {error && (
              <p className="text-center text-xs text-red-400 mb-4 animate-slide-in">{error}</p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={() => pressPin(d)}
                  disabled={loading}
                  className="pin-btn text-center disabled:opacity-40"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => pressPin('back')}
                disabled={loading}
                className="pin-btn text-xl disabled:opacity-40"
              >
                ⌫
              </button>
              <button
                onClick={() => pressPin('0')}
                disabled={loading}
                className="pin-btn text-center disabled:opacity-40"
              >
                0
              </button>
              <button
                onClick={() => pressPin('ok')}
                disabled={loading || pin.length < 4}
                className="pin-btn bg-blue-600 border-blue-600 hover:bg-blue-700 disabled:opacity-40 text-center"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ── Admin setup (hidden) ── */}
        {showSetup && (
          <div className="space-y-4 animate-slide-in">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Settings className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Configuration initiale</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Token Airtable
              </label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetup()}
                placeholder="patXXXXXXXXX.XXXXXXXXX"
                autoFocus
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              onClick={handleSetup}
              disabled={loading || !token}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer et continuer
            </button>

            {setupError && (
              <p className="text-xs text-red-400 text-center">{setupError}</p>
            )}

            <button
              onClick={() => { setShowSetup(false); setSetupError(''); setToken('') }}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors text-center"
            >
              ← Retour
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
