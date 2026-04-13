'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { storage } from '@/lib/storage'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (storage.isLoggedIn()) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router])

  return null
}
