'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload, LogOut } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { updateProfilInAirtable } from '@/lib/airtable'
import { storage } from '@/lib/storage'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState(profil.logo ?? '')
  const [saving, setSaving] = useState(false)

  const {
    register, handleSubmit, reset,
    formState: { errors, isDirty },
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

  return (
    <AppLayout title="Mon profil" subtitle="Informations de votre entreprise">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Logo */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-100">Logo de l'entreprise</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
              {logo
                ? <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                : <span className="text-xs text-slate-400 text-center px-2">Pas de logo</span>
              }
            </div>
            <div>
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Choisir un fichier
              </Button>
              {logo && (
                <button onClick={() => setLogo('')} className="block mt-2 text-xs text-red-500 hover:underline">
                  Supprimer le logo
                </button>
              )}
              <p className="text-xs text-slate-400 mt-1">PNG, JPG — max 500 Ko</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
        </div>

        {/* Company info */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 pb-3 border-b border-slate-100">Informations entreprise</h2>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input label="Raison sociale" required error={errors.nom?.message} {...register('nom')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="SIRET" placeholder="12345678901234" error={errors.siret?.message} {...register('siret')} />
              <Input label="Préfixe factures" placeholder="F-" hint="Ex: TNS-, F-, 2025-" error={errors.prefix?.message} {...register('prefix')} />
            </div>
            <Input label="Adresse" {...register('adresse')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
              <Input label="Téléphone" type="tel" {...register('tel')} />
            </div>
            <Input label="IBAN" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" hint="Apparaît sur les factures" {...register('iban')} />
          </form>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="danger" onClick={handleLogout}>
            <LogOut className="w-3.5 h-3.5" /> Se déconnecter
          </Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={saving}>
            Enregistrer le profil
          </Button>
        </div>

      </div>
    </AppLayout>
  )
}
