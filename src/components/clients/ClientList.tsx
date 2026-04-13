'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { SkeletonRow } from '@/components/ui/Spinner'
import { formatEur } from '@/lib/utils'
import { deleteClient as deleteClientAT } from '@/lib/airtable'
import { useAppStore } from '@/store'
import type { Client } from '@/lib/types'
import { ClientModal } from './ClientModal'

interface ClientListProps {
  loading?: boolean
}

export function ClientList({ loading }: ClientListProps) {
  const { clients, factures, deleteClient: localDelete } = useAppStore()

  const [modalOpen, setModalOpen]   = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [search, setSearch]         = useState('')

  const filtered = clients
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.nom.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    })
    .sort((a, b) => a.nom.localeCompare(b.nom))

  function getClientStats(clientId: string) {
    const facs = factures.filter(f => f.clientId === clientId || f.clientNom === clients.find(c => c.id === clientId)?.nom)
    const ca   = facs.filter(f => f.statut === 'paid').reduce((s, f) => s + f.total, 0)
    return { count: facs.length, ca }
  }

  function openCreate() {
    setEditClient(null)
    setModalOpen(true)
  }

  function openEdit(c: Client) {
    setEditClient(c)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const client = clients.find(c => c.id === deleteId)
    try {
      if (client?.atId) await deleteClientAT(client.atId)
      localDelete(deleteId)
      toast.success('Client supprimé')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Rechercher un client…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 w-64"
        />
        <Button variant="primary" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" /> Nouveau client
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Nom</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Téléphone</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Factures</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">CA total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={Users}
                    title="Aucun client"
                    description="Ajoutez votre premier client pour commencer."
                    action={{ label: '+ Nouveau client', onClick: openCreate }}
                  />
                </td>
              </tr>
            )}

            {!loading && filtered.map((client, i) => {
              const stats = getClientStats(client.id)
              return (
                <tr key={client.id} className={`hover:bg-slate-50 transition-colors ${i < filtered.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                        {client.nom.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{client.nom}</div>
                        {client.siret && <div className="text-xs text-slate-400 font-mono">{client.siret}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{client.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">{client.tel || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 text-right tabular-nums">{stats.count}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right tabular-nums">{formatEur(stats.ca)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(client)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(client.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-slate-400 text-right">
          {filtered.length} client{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Client modal */}
      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editClient}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le client"
        message="Ce client sera supprimé localement et dans Airtable. Les factures associées ne seront pas supprimées."
        confirmLabel="Supprimer"
        danger
        loading={deleting}
      />
    </div>
  )
}
