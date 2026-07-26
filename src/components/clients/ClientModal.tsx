'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { createClient, updateClient as updateClientAT } from '@/lib/airtable'
import { useAppStore } from '@/store'
import { uid } from '@/lib/utils'
import type { Client } from '@/lib/types'

const schema = z.object({
  nom:     z.string().min(1, 'Nom requis'),
  email:   z.string().email('Email invalide').or(z.literal('')),
  tel:     z.string(),
  adresse: z.string(),
  siret:   z.string(),
  notes:   z.string(),
})

type FormData = z.infer<typeof schema>

interface ClientModalProps {
  open: boolean
  onClose: () => void
  client: Client | null
}

export function ClientModal({ open, onClose, client }: ClientModalProps) {
  const { addClient, updateClient: updateLocalClient } = useAppStore()

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nom: '', email: '', tel: '', adresse: '', siret: '', notes: '' },
  })

  useEffect(() => {
    if (open) {
      reset(client
        ? { nom: client.nom, email: client.email, tel: client.tel, adresse: client.adresse, siret: client.siret, notes: client.notes ?? '' }
        : { nom: '', email: '', tel: '', adresse: '', siret: '', notes: '' },
      )
    }
  }, [open, client, reset])

  async function onSubmit(data: FormData) {
    try {
      if (client) {
        // Update
        updateLocalClient(client.id, data)
        if (client.atId) {
          try {
            await updateClientAT(client.atId, data)
            toast.success('Client mis à jour')
          } catch (e) {
            toast.warning(`Modifié localement seulement — Airtable a refusé : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
          }
        } else {
          toast.success('Client mis à jour (local)')
        }
      } else {
        // Create
        const newClient: Client = { id: uid(), ...data }
        try {
          newClient.atId = (await createClient(data)) ?? undefined
          toast.success('Client créé')
        } catch (e) {
          toast.warning(`Client sauvegardé localement — Airtable a refusé : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
        }
        addClient(newClient)
      }
      onClose()
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Modifier le client' : 'Nouveau client'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {client ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Raison sociale / Nom"
          required
          error={errors.nom?.message}
          {...register('nom')}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Téléphone"
            type="tel"
            {...register('tel')}
          />
        </div>
        <Input
          label="Adresse"
          {...register('adresse')}
        />
        <Input
          label="SIRET / Licence number"
          placeholder="SIRET, licence DED, EIN…"
          error={errors.siret?.message}
          hint="Champ libre — SIRET français (14 chiffres), licence Dubaï, EIN, etc."
          {...register('siret')}
        />
        <Textarea
          label="Notes"
          placeholder="Informations complémentaires…"
          {...register('notes')}
        />
      </form>
    </Modal>
  )
}
