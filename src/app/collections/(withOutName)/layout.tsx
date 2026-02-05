'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IconSettings } from '@tabler/icons-react'

import { useGetConfig } from '@/lib/client/query'

import type { ReactNode } from 'react'

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { data: config } = useGetConfig()

  useEffect(() => {
    if (config && !config.connectionString) {
      router.push(`/setup`)
    }
  }, [config, router])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#1e1e1e',
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 32,
          minHeight: 32,
          padding: '0 12px',
          background: '#252526',
          borderBottom: '1px solid #3c3c3c',
          fontSize: 12,
          color: '#cccccc',
          fontFamily: 'var(--font-inter), sans-serif',
          userSelect: 'none',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>ChromaDB Admin</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {config?.connectionString && (
            <span style={{ color: '#858585', fontSize: 11 }}>{config.connectionString}</span>
          )}
          <Link
            href="/setup"
            style={{
              color: '#858585',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              borderRadius: 2,
            }}
          >
            <IconSettings size={14} stroke={1.5} />
          </Link>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}
