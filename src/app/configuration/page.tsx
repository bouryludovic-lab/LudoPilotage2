'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'
import { fetchProfilByBootstrapToken } from '@/lib/airtable'

export default function ConfigurationPage() {
  const { config, setConfig } = useAppStore()
  const [atStatus, setAtStatus]     = useState<'idle' | 'ok' | 'error'>('idle')
  const [atTesting, setAtTesting]   = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [saving, setSaving]         = useState(false)

  const [webhook,   setWebhook]   = useState(config.webhook   ?? '')
  const [claudeKey, setClaudeKey] = useState(config.claudeKey ?? '')
  const [ghToken,   setGhToken]   = useState(config.ghToken   ?? '')
  const [atToken,   setAtToken]   = useState('')

  // Load token client-side only (localStorage not available during SSR)
  useEffect(() => {
    setAtToken(storage.getToken())
    setWebhook(config.webhook   ?? '')
    setClaudeKey(config.claudeKey ?? '')
    setGhToken(config.ghToken   ?? '')
  }, [])

  async function testAirtable() {
    if (!atToken) { toast.error('Token Airtable requis'); return }
    setAtTesting(true)
    setAtStatus('idle')
    try {
      await fetchProfilByBootstrapToken(atToken)
      setAtStatus('ok')
      toast.success('Connexion Airtable réussie ✓')
    } catch {
      setAtStatus('error')
      toast.error('Token invalide ou connexion échouée')
    } finally {
      setAtTesting(false)
    }
  }

  function saveConfig() {
    setSaving(true)
    storage.setToken(atToken)
    setConfig({ ...config, webhook, claudeKey, ghToken })
    toast.success('Configuration sauvegardée')
    setSaving(false)
  }

  return (
    <AppLayout title="Configuration" subtitle="Intégrations et paramètres avancés">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Airtable */}
        <Section title="Connexion Airtable" description="Token d'accès personnel à votre base Airtable">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <PasswordField
                  label="Token Airtable (pat…)"
                  value={atToken}
                  onChange={setAtToken}
                  placeholder="patXXXXXXXXX.XXXXXXXXX"
                  show={showTokens}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={testAirtable}
                  loading={atTesting}
                >
                  Tester
                </Button>
              </div>
            </div>

            {atStatus === 'ok' && (
              <div className="flex items-center gap-2 text-green-700 text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5" /> Connexion active
              </div>
            )}
            {atStatus === 'error' && (
              <div className="flex items-center gap-2 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <XCircle className="w-3.5 h-3.5" /> Connexion échouée — vérifiez le token
              </div>
            )}
          </div>
        </Section>

        {/* Make webhook */}
        <Section title="Assistant & Email (Make)" description="Webhook Make pour l'envoi d'emails et l'assistant IA">
          <Input
            label="URL du webhook Make"
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            placeholder="https://hook.eu1.make.com/XXXXXXX"
          />
          <p className="text-xs text-slate-400 mt-2">
            Ce webhook reçoit les demandes d'envoi de factures par email et les commandes de l'assistant.
          </p>
        </Section>

        {/* Claude */}
        <Section title="Claude AI" description="Clé API Anthropic pour l'assistant IA (optionnel si géré par Make)">
          <PasswordField
            label="Clé API Claude (sk-ant-…)"
            value={claudeKey}
            onChange={setClaudeKey}
            placeholder="sk-ant-api03-XXXXXXXX"
            show={showTokens}
          />
        </Section>

        {/* GitHub */}
        <Section title="Stockage PDF (GitHub)" description="Token GitHub pour stocker les PDFs générés">
          <PasswordField
            label="Token GitHub (ghp_…)"
            value={ghToken}
            onChange={setGhToken}
            placeholder="ghp_XXXXXXXXXXXXXXXX"
            show={showTokens}
          />
          <p className="text-xs text-slate-400 mt-2">
            Les PDFs seront stockés sur <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">bouryludovic-lab/LudoPilotage2/factures/</code>
          </p>
        </Section>

        {/* Toggle show tokens */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowTokens(p => !p)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showTokens ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showTokens ? 'Masquer les clés' : 'Afficher les clés'}
          </button>

          <Button variant="primary" onClick={saveConfig} loading={saving}>
            Sauvegarder la configuration
          </Button>
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
          <strong>Note de sécurité :</strong> Ces clés sont stockées dans le localStorage de votre navigateur.
          N'utilisez jamais cet appareil pour des connexions non sécurisées.
        </div>

      </div>
    </AppLayout>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
      <div className="mb-4 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder, show }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; show?: boolean
}) {
  return (
    <Input
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}
