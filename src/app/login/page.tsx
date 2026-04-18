'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Zap, Delete } from 'lucide-react'
import { storage } from '@/lib/storage'
import { useAppStore } from '@/store'

export default function LoginPage() {
  const [pin, setPin]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [stayLoggedIn, setStay]     = useState(true)
  const [logoClicks, setLogoClicks] = useState(0)
  const [showSetup, setShowSetup]   = useState(false)
  const [setupToken, setSetupToken] = useState('')
  const router   = useRouter()
  const setProfil = useAppStore(s => s.setProfil)

  useEffect(() => {
    if (storage.isLoggedIn()) router.replace('/dashboard')
    // Restore user's previous preference
    setStay(storage.getStayLoggedIn())
  }, [])

  const handleDigit = useCallback((d: string) => {
    if (loading) return
    setError('')
    setPin(p => p.length < 4 ? p + d : p)
  }, [loading])

  const handleDelete = useCallback(() => {
    if (loading) return
    setPin(p => p.slice(0, -1))
    setError('')
  }, [loading])

  useEffect(() => {
    if (pin.length === 4) submit(pin)
  }, [pin])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handleDigit(e.key)
      else if (e.key === 'Backspace') handleDelete()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleDigit, handleDelete])

  async function submit(p: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      })
      const data = await res.json()
      if (data.ok) {
        storage.setToken(data.userEmail || p, stayLoggedIn)
        if (data.profil) {
          setProfil(data.profil)
          storage.setProfil(data.profil)
        }
        toast.success('Connexion réussie')
        router.replace('/dashboard')
      } else {
        setError(data.error || 'PIN incorrect')
        setPin('')
        setLoading(false)
      }
    } catch {
      setError('Erreur de connexion')
      setPin('')
      setLoading(false)
    }
  }

  function handleLogoClick() {
    const next = logoClicks + 1
    setLogoClicks(next)
    if (next >= 5) {
      setShowSetup(p => !p)
      setLogoClicks(0)
    }
  }

  function saveSetupToken() {
    if (!setupToken.startsWith('pat')) {
      toast.error('Token invalide (doit commencer par pat…)')
      return
    }
    storage.setBootstrapToken(setupToken)
    toast.success('Token Bootstrap sauvegardé')
    setShowSetup(false)
    setSetupToken('')
  }

  const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0C1628' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-violet w-[600px] h-[600px] -top-48 -left-48 opacity-35" />
        <div className="orb orb-indigo w-[500px] h-[500px] -bottom-48 -right-48 opacity-25" />
      </div>

      <div className="relative w-full max-w-[320px] animate-slide-up">

        {/* Logo + title */}
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={handleLogoClick}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, #3B6BE8, #2563EB)',
              boxShadow: '0 0 40px rgba(59,107,232,0.3)',
              cursor: 'default',
            }}
          >
            <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">LudoPilotage</h1>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Entrez votre code PIN
          </p>
          <Link href="/signup"
            className="mt-2 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors">
            Première connexion ? Créer un compte
          </Link>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0,1,2,3].map(i => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full transition-all duration-200"
              style={{
                background: i < pin.length ? 'linear-gradient(135deg, #3B6BE8, #2563EB)' : 'rgba(255,255,255,0.12)',
                transform: i < pin.length ? 'scale(1.3)' : 'scale(1)',
                boxShadow: i < pin.length ? '0 0 10px rgba(59,107,232,0.4)' : 'none',
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm font-medium text-red-400 mb-4 animate-fade-in">{error}</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {DIGITS.map((d, i) => {
            if (d === '') return <div key={i} />
            if (d === '⌫') {
              return (
                <button key={i} className="pin-btn flex items-center justify-center" onClick={handleDelete}>
                  <Delete className="w-5 h-5" />
                </button>
              )
            }
            return (
              <button key={i} className="pin-btn" onClick={() => handleDigit(d)}>
                {d}
              </button>
            )
          })}
        </div>

        {/* Stay logged in checkbox */}
        <div className="flex items-center justify-center gap-2.5 mt-6">
          <button
            role="checkbox"
            aria-checked={stayLoggedIn}
            onClick={() => setStay(p => !p)}
            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: stayLoggedIn ? 'linear-gradient(135deg, #3B6BE8, #2563EB)' : 'rgba(255,255,255,0.06)',
              border: stayLoggedIn ? 'none' : '1px solid rgba(255,255,255,0.18)',
            }}
          >
            {stayLoggedIn && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Rester connecté
          </span>
        </div>
        <p className="text-center text-[11px] mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {stayLoggedIn
            ? 'Votre session sera conservée même après fermeture du navigateur'
            : 'Votre session expirera à la fermeture de l\'onglet'}
        </p>

        {loading && (
          <div className="flex justify-center mt-5">
            <div className="w-5 h-5 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
          </div>
        )}

        {/* Bootstrap setup (hidden, 5x logo clicks) */}
        {showSetup && (
          <div
            className="mt-8 p-4 rounded-2xl animate-slide-up"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Configuration Bootstrap
            </p>
            <input
              type="password"
              className="input-dark mb-3"
              placeholder="pat…"
              value={setupToken}
              onChange={e => setSetupToken(e.target.value)}
            />
            <button
              onClick={saveSetupToken}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #3B6BE8, #2563EB)' }}
            >
              Sauvegarder
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
