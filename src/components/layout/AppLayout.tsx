'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { storage } from '@/lib/storage'
import { useAppStore } from '@/store'

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const router = useRouter()
  const loadFromStorage = useAppStore(s => s.loadFromStorage)

  useEffect(() => {
    if (!storage.isLoggedIn()) {
      router.replace('/login')
      return
    }
    loadFromStorage()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080B14' }}>
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-auto ml-[220px]">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
