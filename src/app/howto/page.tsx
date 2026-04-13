'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { FileText, Users, Send, Settings, MessageSquare } from 'lucide-react'

const STEPS = [
  {
    icon: Settings,
    title: '1. Configuration',
    content: 'Allez dans Configuration pour renseigner votre token Airtable et le webhook Make. Ces informations sont nécessaires pour synchroniser vos données et envoyer des emails.',
  },
  {
    icon: FileText,
    title: '2. Mon profil',
    content: 'Renseignez les informations de votre entreprise (nom, SIRET, adresse, IBAN). Ces données seront automatiquement incluses dans chaque facture générée.',
  },
  {
    icon: Users,
    title: '3. Créer vos clients',
    content: 'Dans l\'onglet Clients, ajoutez vos clients avec leurs coordonnées. Ces informations seront auto-complétées lors de la création d\'une facture.',
  },
  {
    icon: FileText,
    title: '4. Créer une facture',
    content: 'Cliquez sur "+ Nouvelle facture", sélectionnez un client, ajoutez vos lignes de prestation et cliquez sur "Créer". La facture est sauvegardée localement et synchronisée avec Airtable.',
  },
  {
    icon: Send,
    title: '5. Envoyer par email',
    content: 'Dans la liste des factures, cliquez sur l\'icône d\'envoi. Un email sera envoyé via Make avec les informations de la facture. Le statut passe automatiquement à "Envoyée".',
  },
  {
    icon: MessageSquare,
    title: '6. Assistant coaching',
    content: 'La section Coaching vous permet de poser des questions à l\'assistant IA via le webhook Make. Les réponses sont affichées directement dans l\'interface.',
  },
]

export default function HowToPage() {
  return (
    <AppLayout title="How to use" subtitle="Guide d'utilisation de la plateforme">
      <div className="max-w-2xl mx-auto space-y-4">
        {STEPS.map((step, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex gap-4">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <step.icon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{step.content}</p>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
