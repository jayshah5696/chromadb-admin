'use client'

import Link from 'next/link'
import { IconSettings } from '@tabler/icons-react'
import { ModalsProvider } from '@mantine/modals'

import { useGetConfig } from '@/lib/client/query'
import CollectionSidebar from '@/components/CollectionSidebar'

import type { ReactNode } from 'react'

export default function Layout({ children, params }: { children: ReactNode; params: { name: string } }) {
  const { data: config } = useGetConfig()
  const { name: currentCollectionName } = params

  return (
    <ModalsProvider>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>ChromaDB Admin</span>
            <span style={{ color: '#858585' }}>/</span>
            <span style={{ color: '#4fc1ff' }}>{decodeURIComponent(currentCollectionName)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {config && (
              <span style={{ color: '#858585', fontSize: 11 }}>
                {config.connectionString}
                {config.tenant !== 'default_tenant' ? ` / ${config.tenant}` : ''}
                {config.database !== 'default_database' ? ` / ${config.database}` : ''}
              </span>
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

        {/* Main content: sidebar + children */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <CollectionSidebar currentCollection={decodeURIComponent(currentCollectionName)} />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
        </div>
      </div>
    </ModalsProvider>
  )
}
