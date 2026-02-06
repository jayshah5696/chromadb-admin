'use client'

import { useState, useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { notifications } from '@mantine/notifications'
import { SegmentedControl } from '@mantine/core'

import { useGetEmbedding, useGetConfig } from '@/lib/client/query'
import { currentPageAtom, queryAtom, whereFilterAtom } from '@/components/RecordPage/atom'

import styles from './index.module.scss'

const DataToolbar = () => {
  const [query, setQuery] = useAtom(queryAtom)
  const [whereFilter, setWhereFilter] = useAtom(whereFilterAtom)
  const setCurrentPage = useSetAtom(currentPageAtom)
  const { data: config } = useGetConfig()

  const [queryValue, setQueryValue] = useState(query)
  const [whereInput, setWhereInput] = useState(whereFilter)
  const [queryMode, setQueryMode] = useState<'vector' | 'text'>('vector')
  const [embeddingInfo, setEmbeddingInfo] = useState<{ dimension: number; text: string } | null>(null)

  const getEmbeddingMutation = useGetEmbedding()

  useEffect(() => {
    if (queryMode === 'vector' || !embeddingInfo) {
      setQueryValue(query)
    }
  }, [query, queryMode, embeddingInfo])

  useEffect(() => {
    setWhereInput(whereFilter)
  }, [whereFilter])

  const handleQuery = () => {
    if (queryMode === 'text') {
      handleTextQuery()
    } else {
      setQuery(queryValue)
      setCurrentPage(1)
    }
  }

  const handleClear = () => {
    setQueryValue('')
    setQuery('')
    setCurrentPage(1)
    setEmbeddingInfo(null)
    setWhereInput('')
    setWhereFilter('')
  }


  const handleApplyFilter = () => {
    if (!whereInput.trim()) {
      setWhereFilter('')
      setCurrentPage(1)
      return
    }

    try {
      JSON.parse(whereInput)
      setWhereFilter(whereInput)
      setCurrentPage(1)
    } catch (error) {
      notifications.show({
        title: 'Invalid metadata filter',
        message: 'Please provide valid JSON for the metadata where filter.',
        color: 'red',
      })
    }
  }

  const handleTextQuery = async () => {
    if (!queryValue.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter query text', color: 'red' })
      return
    }
    if (!config?.embeddingModelUrl) {
      notifications.show({
        title: 'Error',
        message: 'Please configure Embedding Model URL in settings first',
        color: 'red',
      })
      return
    }
    try {
      const originalText = queryValue
      const result = await getEmbeddingMutation.mutateAsync({
        text: originalText,
        modelUrl: config.embeddingModelUrl,
        model: config.embeddingModel,
      })
      setEmbeddingInfo({ dimension: result.dimension, text: originalText })
      const embeddingString = result.embedding.join(', ')
      setQuery(embeddingString)
      setCurrentPage(1)
      notifications.show({
        title: 'Success',
        message: `Embedding obtained (dim: ${result.dimension})`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Failed to get Embedding',
        message: (error as Error).message,
        color: 'red',
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery()
    }
  }

  return (
    <div className={styles.toolbar}>
      <SegmentedControl
        size="xs"
        className={styles.modeToggle}
        value={queryMode}
        onChange={value => {
          setQueryMode(value as 'vector' | 'text')
          if (value === 'vector') setEmbeddingInfo(null)
        }}
        data={[
          { label: 'Vector/ID', value: 'vector' },
          { label: 'Text', value: 'text' },
        ]}
        styles={{
          root: { backgroundColor: '#3c3c3c' },
          label: { fontSize: '11px', padding: '2px 8px', color: '#cccccc' },
          indicator: { backgroundColor: '#094771' },
        }}
      />

      <input
        className={styles.searchInput}
        placeholder={queryMode === 'vector' ? '0.1, 0.2, 0.3 or record ID...' : 'Enter text to query...'}
        value={queryValue}
        onChange={e => setQueryValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {embeddingInfo && queryMode === 'text' && (
        <span className={styles.embeddingBadge}>
          &quot;{embeddingInfo.text.length > 15 ? embeddingInfo.text.substring(0, 15) + '...' : embeddingInfo.text}
          &quot; dim:{embeddingInfo.dimension}
        </span>
      )}

      <button
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={handleQuery}
        disabled={getEmbeddingMutation.isPending}
      >
        {getEmbeddingMutation.isPending && <span className={styles.spinner} />}
        Query
      </button>

      <input
        className={styles.filterInput}
        placeholder='Metadata where JSON, e.g. {"source":"docs"}'
        value={whereInput}
        onChange={e => setWhereInput(e.target.value)}
      />

      <button className={`${styles.btn} ${styles.btnDefault}`} onClick={handleApplyFilter}>
        Apply Filter
      </button>

      <button className={`${styles.btn} ${styles.btnDefault}`} onClick={handleClear}>
        Clear
      </button>
    </div>
  )
}

export default DataToolbar
