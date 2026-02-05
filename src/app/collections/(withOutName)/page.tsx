'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { useGetCollections, useGetConfig } from '@/lib/client/query'

export default function CollectionsPage() {
  const router = useRouter()
  const { data: config } = useGetConfig()
  const { data: collections, isError, error } = useGetCollections(config)

  useEffect(() => {
    if (collections != null && collections.length > 0) {
      router.push(`/collections/${collections[0]}`)
    }
  }, [collections, router])

  if (isError) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 40,
          color: '#cccccc',
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: '#f44747', marginBottom: 12 }}>{error.message}</div>
        <Link href="/setup" style={{ color: '#4fc1ff', fontSize: 13 }}>
          Go to Setup
        </Link>
      </div>
    )
  }

  if (collections != null && collections.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 40,
          color: '#cccccc',
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        <div style={{ fontSize: 14, color: '#858585', marginBottom: 12 }}>No collections found</div>
        <Link href="/setup" style={{ color: '#4fc1ff', fontSize: 13 }}>
          Setup a new Chroma instance
        </Link>
      </div>
    )
  }

  return null
}
