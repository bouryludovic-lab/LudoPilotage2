'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, XCircle, Eye, EyeOff, Settings, Shield } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store'
import { storage } from '@/lib/storage'

export default function ConfigurationPage() {
  const { config, setConfig, profil, setProfil } = useAppStore()
  const [atStatus, setAtStatus]     = useState<'idle' | 'ok' | 'error'>('idle')
  const [atTesting, setAtTesting]   = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [saving, setSaving]         = useState(false)

  const [webhook,   setWebhook]   = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [ghToken,   setGhToken]   = useState('')
  const [atToken,   setAtToken]   = useState('')

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
      const res = await fetch('/api/airtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'tblxiuLqflhdTdW6n', method: 'GET', useFieldNames: true }),
      })
      if (res.ok) {
        setAtStatus('ok')
        toast.success('Connexion Airtable active ✓')
      } else {
        setAtStatus('error')
        toast.error('Token invalide')
      }
    } catch {
      setAtStatus('error')
      toast.error('Erreur de connexion')
    } finally {
      setAtTesting(false)
    }
  }

  function saveConfig() {
    setSaving(true)
    storage.setToken(atToken)
    setConfig({ ...config, webhook, claudeKey, ghToken })
    setProfil({ ...profil, webhook, ghToken, claudeKey })
    toast.success('Configuration sauvegardée')
    setSaving(false)
  }

  return (
    <AppLayout title="Configuration" subtitle="Intégrations et paramètres avancés">
      <div className="max-w-2xl space-y-4">

        {/* Airtable */}
        <Section icon={Shield} title="Connexion Airtable" description="Token d'accès personnel pour synchroniser les données">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <PasswordField label="Token Airtable (pat…)" value={atToken} onChange={setAtToken}
                  placeholder="patXXXXXXXXX.XXXXXXXXX" show={showTokens} />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" size="sm" onClick={testAirtable} loading={atTesting}>
                  Tester
                </Button>
              </div>
            </div>
            {atStatus === 'ok' && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80' }}>
                <CheckCircle className="w-3.5 h-3.5" /> Connexion active
              </div>
            )}
            {atStatus === 'error' && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171' }}>
                <XCircle className="w-3.5 h-3.5" /> Connexion échouée — vérifiez le token
              </div>
            )}
          </div>
        </Section>

        {/* Make webhook */}
        <Section icon={Settings} title="Assistant & Email (Make)" description="Webhook Make pour l'envoi d'emails et l'assistant IA">
          <Input label="URL du webhook Make" value={webhook} onChange={e => setWebhook(e.target.value)}
            placeholder="https://hook.eu1.make.com/XXXXXXX" />
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Ce webhook reçoit les demandes d'envoi de factures et les commandes de l'assistant.
          </p>
        </Section>

        {/* Claude */}
        <Section icon={Shield} title="Claude AI" description="Clé API Anthropic pour les agents IA">
          <PasswordField label="Clé API Claude (sk-ant-…)" value={claudeKey} onChange={setClaudeKey}
            placeholder="sk-ant-api03-XXXXXXXX" show={showTokens} />
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Utilisée directement par les agents IA dans le module Agent.
          </p>
        </Section>

        {/* GitHub */}
        <Section icon={Shield} title="Stockage PDF (GitHub)" description="Token GitHub pour stocker les PDFs générés">
          <PasswordField label="Token GitHub (ghp_…)" value={ghToken} onChange={setGhToken}
            placeholder="ghp_XXXXXXXXXXXXXXXX" show={showTokens} />
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Les PDFs seront stockés sur <code className="px-1 py-0.5 rounded text-xs"
              style={{ background: 'rgba(255,255,255,0.08)' }}>bouryludovic-lab/LudoPilotage2/factures/</code>
          </p>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowTokens(p => !p)}
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {showTokens ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showTokens ? 'Masquer les clés' : 'Afficher les clés'}
          </button>
          <Button variant="primary" onClick={saveConfig} loading={saving}>
            Sauvegarder
          </Button>
        </div>

        {/* Security note */}
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#FCD34D' }} />
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#FCD34D' }}>Note de sécurité</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Ces clés sont stockées localement. Le token Airtable principal est géré côté serveur via les variables d'environnement Vercel.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Section({ icon: Icon, title, description, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.12)' }}>
          <Icon className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white/80">{title}</h2>
          {description && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function PasswordField({ label, value, onChange, placeholder, show }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; show?: boolean
}) {
  return (
    <Input label={label} type={show ? 'text' : 'password'} value={value}
      onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  )
}
