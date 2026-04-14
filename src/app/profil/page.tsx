'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Upload, Trash2, User, Building2, CreditCard, Zap } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { updateProfilInAirtable } from '@/lib/airtable'

const schema = z.object({
  nom:     z.string().min(1, 'Nom requis'),
  siret:   z.string().refine(v => !v || /^\d{14}$/.test(v.replace(/\s/g, '')), 'SIRET invalide (14 chiffres)').or(z.literal('')),
  adresse: z.string(),
  email:   z.string().email('Email invalide').or(z.literal('')),
  tel:     z.string(),
  iban:    z.string(),
  prefix:  z.string().min(1, 'Préfixe requis'),
})

type FormData = z.infer<typeof schema>

export default function ProfilPage() {
  const { profil, setProfil } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo]     = useState(profil.logo ?? '')
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
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
  }, [profil.atId])

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

  return (
    <AppLayout title="Mon profil" subtitle="Informations de ton entreprise">
      <div className="max-w-2xl space-y-4">

        {/* Logo */}
        <Section icon={Building2} title="Logo de l'entreprise">
          <div className="flex items-center gap-5">
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{
                background: logo ? 'transparent' : 'rgba(124,58,237,0.08)',
                border: `2px dashed ${logo ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {logo
                ? <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                : <Building2 className="w-8 h-8" style={{ color: 'rgba(255,255,255,0.2)' }} />
              }
            </div>
            <div className="space-y-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                {logo ? 'Changer le logo' : 'Importer un logo'}
              </Button>
              {logo && (
                <Button variant="danger" size="sm" onClick={() => setLogo('')}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </Button>
              )}
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>PNG, JPG — max 500 Ko. Apparaît sur les factures PDF.</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
          </div>
        </Section>

        {/* Entreprise */}
        <Section icon={Building2} title="Informations entreprise">
          <div className="space-y-4">
            <Input label="Raison sociale / Nom" required error={errors.nom?.message} {...register('nom')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="SIRET" placeholder="12345678901234" error={errors.siret?.message} {...register('siret')} />
              <Input label="Préfixe factures" placeholder="F-" hint="Ex: F-, TNS-, 2025-" error={errors.prefix?.message} {...register('prefix')} />
            </div>
            <Input label="Adresse complète" placeholder="123 rue de la Paix, 75001 Paris" {...register('adresse')} />
          </div>
        </Section>

        {/* Contact */}
        <Section icon={User} title="Contact">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" placeholder="contact@monentreprise.fr" error={errors.email?.message} {...register('email')} />
            <Input label="Téléphone" type="tel" placeholder="+33 6 00 00 00 00" {...register('tel')} />
          </div>
        </Section>

        {/* IBAN */}
        <Section icon={CreditCard} title="IBAN (paiements)">
          <Input
            label="IBAN"
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            hint="Apparaît sur tes factures pour le virement"
            {...register('iban')}
          />
        </Section>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit(onSubmit)}
            loading={saving}
          >
            <Zap className="w-4 h-4" />
            Enregistrer le profil
          </Button>
        </div>

        {/* Status */}
        {!profil.atId && (
          <div className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#FCD34D' }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#FCD34D' }}>Synchronisation requise</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Les données Airtable ne sont pas encore chargées. Lance une synchronisation depuis le dashboard ou clique sur l'icône ↻ en haut à droite.
              </p>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.12)' }}>
          <Icon className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <h2 className="text-sm font-bold text-white/80">{title}</h2>
      </div>
      {children}
    </div>
  )
}
