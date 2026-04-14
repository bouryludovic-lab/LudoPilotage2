'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Zap, Eye, EyeOff } from 'lucide-react'

type Step = 'account' | 'company' | 'pin'

interface FormData {
  nom:     string
  email:   string
  siret:   string
  adresse: string
  tel:     string
  iban:    string
  prefix:  string
  pin:     string
  pinConfirm: string
}

const EMPTY: FormData = {
  nom: '', email: '', siret: '', adresse: '', tel: '',
  iban: '', prefix: 'F-', pin: '', pinConfirm: '',
}

export default function SignupPage() {
  const router   = useRouter()
  const [step, setStep]       = useState<Step>('account')
  const [form, setForm]       = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [errors, setErrors]   = useState<Partial<FormData>>({})

  const set = (k: keyof FormData, v: string) => {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: '' }))
  }

  // ── Step 1: account info ──────────────────────────────────────────────────

  function validateAccount() {
    const errs: Partial<FormData> = {}
    if (!form.nom.trim())    errs.nom   = 'Nom requis'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Email invalide'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextToCompany() {
    if (validateAccount()) setStep('company')
  }

  // ── Step 2: company info (optional) ──────────────────────────────────────

  function nextToPin() {
    setStep('pin')
  }

  // ── Step 3: choose PIN ────────────────────────────────────────────────────

  function validatePin() {
    const errs: Partial<FormData> = {}
    if (!/^\d{4}$/.test(form.pin))         errs.pin        = 'PIN doit être 4 chiffres'
    if (form.pin !== form.pinConfirm)       errs.pinConfirm = 'PINs différents'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validatePin()) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom:     form.nom.trim(),
          email:   form.email.trim(),
          pin:     form.pin,
          siret:   form.siret.trim(),
          adresse: form.adresse.trim(),
          tel:     form.tel.trim(),
          iban:    form.iban.trim(),
          prefix:  form.prefix.trim() || 'F-',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Compte créé ! Connectez-vous avec votre PIN.')
        router.replace('/login')
      } else {
        toast.error(data.error ?? 'Erreur lors de la création du compte')
      }
    } catch {
      toast.error('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  // ── Shared field renderer ─────────────────────────────────────────────────

  function Field({
    label, value, onChange, type = 'text', placeholder = '', required = false, error = '', hint = '',
  }: {
    label: string; value: string; onChange: (v: string) => void
    type?: string; placeholder?: string; required?: boolean; error?: string; hint?: string
  }) {
    return (
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {label}{required && <span className="text-violet-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-dark w-full"
          style={error ? { borderColor: 'rgba(248,113,113,0.6)' } : {}}
        />
        {hint  && <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{hint}</p>}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#080B14' }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="orb orb-violet w-[600px] h-[600px] -top-48 -left-48 opacity-30" />
        <div className="orb orb-indigo w-[500px] h-[500px] -bottom-48 -right-48 opacity-20" />
      </div>

      <div className="relative w-full max-w-[420px] animate-slide-up">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', boxShadow: '0 0 32px rgba(124,58,237,0.35)' }}>
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Créer un compte</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>LudoPilotage SaaS</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['account', 'company', 'pin'] as Step[]).map((s, i) => {
            const done   = step === 'company' ? i === 0 : step === 'pin' ? i <= 1 : false
            const active = step === s
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px" style={{ background: done ? '#7C3AED' : 'rgba(255,255,255,0.1)' }} />}
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                  style={{
                    background: active ? 'linear-gradient(135deg,#7C3AED,#4F46E5)' : done ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)',
                    color: active || done ? 'white' : 'rgba(255,255,255,0.3)',
                    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >{i + 1}</div>
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Step 1 – account */}
          {step === 'account' && (
            <>
              <p className="text-sm font-semibold text-white/70 mb-1">Informations de connexion</p>
              <Field label="Prénom / Nom ou Raison sociale" value={form.nom} onChange={v => set('nom', v)}
                required placeholder="Ex: Jean Dupont" error={errors.nom} />
              <Field label="Adresse email" value={form.email} onChange={v => set('email', v)}
                type="email" required placeholder="jean@exemple.fr" error={errors.email} />
              <button onClick={nextToCompany}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
                Continuer
              </button>
            </>
          )}

          {/* Step 2 – company */}
          {step === 'company' && (
            <>
              <p className="text-sm font-semibold text-white/70 mb-1">Informations entreprise <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>(optionnel)</span></p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SIRET" value={form.siret} onChange={v => set('siret', v)} placeholder="14 chiffres" />
                <Field label="Préfixe factures" value={form.prefix} onChange={v => set('prefix', v)}
                  placeholder="F-" hint="Ex: F-, TNS-" />
              </div>
              <Field label="Adresse" value={form.adresse} onChange={v => set('adresse', v)} placeholder="1 rue de la Paix, Paris" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Téléphone" value={form.tel} onChange={v => set('tel', v)} placeholder="06 00 00 00 00" />
              </div>
              <Field label="IBAN" value={form.iban} onChange={v => set('iban', v)}
                placeholder="FR76 XXXX XXXX XXXX…" hint="Apparaîtra sur vos factures" />
              <div className="flex gap-2">
                <button onClick={() => setStep('account')}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  Retour
                </button>
                <button onClick={nextToPin}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
                  Continuer
                </button>
              </div>
            </>
          )}

          {/* Step 3 – PIN */}
          {step === 'pin' && (
            <>
              <p className="text-sm font-semibold text-white/70 mb-1">Choisissez votre PIN</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Ce code à 4 chiffres sera votre mot de passe pour accéder à l'application.
              </p>
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  PIN <span className="text-violet-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={form.pin}
                    onChange={e => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4 chiffres"
                    maxLength={4}
                    className="input-dark w-full pr-10"
                    style={errors.pin ? { borderColor: 'rgba(248,113,113,0.6)' } : {}}
                  />
                  <button type="button" onClick={() => setShowPin(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.pin && <p className="mt-1 text-xs text-red-400">{errors.pin}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Confirmer le PIN <span className="text-violet-400">*</span>
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={form.pinConfirm}
                  onChange={e => set('pinConfirm', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Répétez le PIN"
                  maxLength={4}
                  className="input-dark w-full"
                  style={errors.pinConfirm ? { borderColor: 'rgba(248,113,113,0.6)' } : {}}
                />
                {errors.pinConfirm && <p className="mt-1 text-xs text-red-400">{errors.pinConfirm}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('company')}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                  Retour
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
                  {loading ? 'Création…' : 'Créer mon compte'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Login link */}
        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Déjà un compte ?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
