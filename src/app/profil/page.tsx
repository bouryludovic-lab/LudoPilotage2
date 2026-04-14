'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload, LogOut, UserCircle, RefreshCw } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { updateProfilInAirtable } from '@/lib/airtable'
import { storage } from '@/lib/storage'
import { useRouter } from 'next/navigation'

const CARD = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
}
const SECTION_TITLE = {
  color: 'rgba(255,255,255,0.6)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const schema = z.object({
  nom:     z.string().min(1, 'Nom requis'),
  siret:   z.string().refine(v => !v || /^\d{14}$/.test(v.replace(/\s/g, '')), 'SIRET invalide'),
  adresse: z.string(),
  email:   z.string().email('Email invalide').or(z.literal('')),
  tel:     z.string(),
  iban:    z.string(),
  prefix:  z.string().min(1, 'Préfixe requis'),
})

type FormData = z.infer<typeof schema>

export default function ProfilPage() {
  const { profil, setProfil } = useAppStore()
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo,   setLogo]   = useState(profil.logo ?? '')
  const [saving, setSaving] = useState(false)

  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom: profil.nom, siret: profil.siret, adresse: profil.adresse,
      email: profil.email, tel: profil.tel, iban: profil.iban, prefix: profil.prefix,
    },
  })

  useEffect(() => {
    reset({
      nom: profil.nom, siret: profil.siret, adresse: profil.adresse,
      email: profil.email, tel: profil.tel, iban: profil.iban, prefix: profil.prefix,
    })
    setLogo(profil.logo ?? '')
  }, [profil, reset])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500_000) { toast.error('Logo trop lourd (max 500 Ko)'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(String(reader.result))
    reader.readAsDataURL(file)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    const updated = { ...profil, ...data, logo }
    setProfil(updated)
    try {
      if (profil.atId) await updateProfilInAirtable(profil.atId, updated)
      toast.success('Profil enregistré')
    } catch {
      toast.warning('Sauvegardé localement — sync Airtable échouée')
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    storage.logout()
    router.replace('/login')
  }

  function handleSwitchAccount() {
    storage.logout()
    router.replace('/login')
  }

  return (
    <AppLayout title="Mon profil" subtitle="Informations de votre entreprise">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Account card ──────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={CARD}>
          <h2 className="text-sm font-semibold mb-4 pb-3" style={SECTION_TITLE}>
            Compte connecté
          </h2>
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #4F46E5)' }}>
              {(profil.nom || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white/85 truncate">{profil.nom || 'Mon compte'}</p>
              {profil.email && (
                <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{profil.email}</p>
              )}
              {profil.siret && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  SIRET : {profil.siret}
                </p>
              )}
            </div>
          </div>

          {/* Account actions */}
          <div className="flex gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={handleSwitchAccount}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,58,237,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(124,58,237,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = '#A78BFA' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Changer de compte
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(248,113,113,0.8)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#F87171' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(248,113,113,0.8)' }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Se déconnecter
            </button>
          </div>
        </div>

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={CARD}>
          <h2 className="text-sm font-semibold mb-4 pb-3" style={SECTION_TITLE}>
            Logo de l'entreprise
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ border: '2px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}>
              {logo
                ? <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                : <UserCircle className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
              }
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              >
                <Upload className="w-3.5 h-3.5" /> Choisir un logo
              </button>
              {logo && (
                <button onClick={() => setLogo('')}
                  className="block mt-2 text-xs text-red-400 hover:text-red-300 transition-colors">
                  Supprimer le logo
                </button>
              )}
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>PNG, JPG — max 500 Ko</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
        </div>

        {/* ── Company info ──────────────────────────────────────────────── */}
        <div className="rounded-2xl p-5" style={CARD}>
          <h2 className="text-sm font-semibold mb-4 pb-3" style={SECTION_TITLE}>
            Informations entreprise
          </h2>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Raison sociale <span className="text-violet-400">*</span>
              </label>
              <input className="input-dark w-full" {...register('nom')} />
              {errors.nom && <p className="mt-1 text-xs text-red-400">{errors.nom.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>SIRET</label>
                <input className="input-dark w-full" placeholder="14 chiffres" {...register('siret')} />
                {errors.siret && <p className="mt-1 text-xs text-red-400">{errors.siret.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Préfixe factures <span className="text-violet-400">*</span>
                </label>
                <input className="input-dark w-full" placeholder="F-" {...register('prefix')} />
                {errors.prefix && <p className="mt-1 text-xs text-red-400">{errors.prefix.message}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Adresse</label>
              <input className="input-dark w-full" {...register('adresse')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Email</label>
                <input type="email" className="input-dark w-full" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>Téléphone</label>
                <input type="tel" className="input-dark w-full" {...register('tel')} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>IBAN</label>
              <input className="input-dark w-full" placeholder="FR76 XXXX XXXX XXXX…" {...register('iban')} />
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Apparaît sur les factures</p>
            </div>
          </form>
        </div>

        {/* ── Save ──────────────────────────────────────────────────────── */}
        <div className="flex justify-end pb-8">
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={saving}>
            Enregistrer le profil
          </Button>
        </div>

      </div>
    </AppLayout>
  )
}
