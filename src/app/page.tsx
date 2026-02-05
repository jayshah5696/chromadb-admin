'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useGetConfig } from '@/lib/client/query'

export default function Home() {
  const router = useRouter()
  const { data: appConfig, isLoading } = useGetConfig()

  useEffect(() => {
    if (!isLoading) {
      if (appConfig?.connectionString) {
        router.replace('/collections')
      } else {
        router.replace('/setup')
      }
    }
  }, [appConfig, isLoading, router])

  return (
    <div
      style={{
        background: '#1e1e1e',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#858585', fontSize: 13, fontFamily: 'sans-serif' }}>Loading...</div>
    </div>
  )
}
