'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { IconTable, IconEdit, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { Modal, TextInput, Group, Button } from '@mantine/core'

import { useGetCollections, useGetConfig, useDeleteCollection, useRenameCollection } from '@/lib/client/query'

import styles from './index.module.scss'

type SortMode = 'alpha-asc' | 'alpha-desc' | 'recent'

type SidebarState = {
  filter: string
  sortMode: SortMode
  scrollTop: number
  recentlyViewed: string[]
}

const SIDEBAR_STATE_KEY = 'chromadb-admin.sidebar.state'

function readSidebarState(): SidebarState {
  if (typeof window === 'undefined') {
    return { filter: '', sortMode: 'alpha-asc', scrollTop: 0, recentlyViewed: [] }
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_STATE_KEY)
    if (!raw) return { filter: '', sortMode: 'alpha-asc', scrollTop: 0, recentlyViewed: [] }
    const parsed = JSON.parse(raw)
    return {
      filter: typeof parsed.filter === 'string' ? parsed.filter : '',
      sortMode: parsed.sortMode ?? 'alpha-asc',
      scrollTop: typeof parsed.scrollTop === 'number' ? parsed.scrollTop : 0,
      recentlyViewed: Array.isArray(parsed.recentlyViewed) ? parsed.recentlyViewed : [],
    }
  } catch {
    return { filter: '', sortMode: 'alpha-asc', scrollTop: 0, recentlyViewed: [] }
  }
}

const CollectionSidebar = ({ currentCollection }: { currentCollection?: string }) => {
  const router = useRouter()
  const { data: config } = useGetConfig()
  const { data: collections } = useGetCollections(config)
  const deleteCollectionMutation = useDeleteCollection()
  const renameCollectionMutation = useRenameCollection()

  const initialState = useMemo(() => readSidebarState(), [])
  const [filter, setFilter] = useState(initialState.filter)
  const [sortMode, setSortMode] = useState<SortMode>(initialState.sortMode)
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(initialState.recentlyViewed)

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; collection: string } | null>(null)
  const [renameModalOpened, setRenameModalOpened] = useState(false)
  const [renameTarget, setRenameTarget] = useState('')
  const [newCollectionName, setNewCollectionName] = useState('')
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const sortedCollections = useMemo(() => {
    const all = [...(collections || [])]
    all.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    if (sortMode === 'alpha-desc') {
      return all.reverse()
    }
    if (sortMode === 'recent') {
      const recentSet = new Set(recentlyViewed)
      const recentPart = recentlyViewed.filter(item => all.includes(item))
      const remaining = all.filter(item => !recentSet.has(item))
      return [...recentPart, ...remaining]
    }
    return all
  }, [collections, sortMode, recentlyViewed])

  const filtered = sortedCollections.filter(c => c.toLowerCase().includes(filter.toLowerCase()))

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      SIDEBAR_STATE_KEY,
      JSON.stringify({ filter, sortMode, scrollTop: listRef.current?.scrollTop || 0, recentlyViewed })
    )
  }, [filter, sortMode, recentlyViewed])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = initialState.scrollTop
    }
  }, [initialState.scrollTop])

  const handleClick = useCallback(
    (name: string) => {
      setRecentlyViewed(prev => [name, ...prev.filter(item => item !== name)].slice(0, 10))
      router.push(`/collections/${name}`)
    },
    [router]
  )

  const handleContextMenu = useCallback((e: React.MouseEvent, collection: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, collection })
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  const handleRenameClick = () => {
    if (!contextMenu) return
    setRenameTarget(contextMenu.collection)
    setNewCollectionName(contextMenu.collection)
    setRenameModalOpened(true)
    setContextMenu(null)
  }

  const handleRenameSubmit = async () => {
    if (!newCollectionName.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter a new collection name', color: 'red' })
      return
    }
    if (newCollectionName === renameTarget) {
      notifications.show({ title: 'Error', message: 'New name cannot be the same as the current name', color: 'red' })
      return
    }
    try {
      await renameCollectionMutation.mutateAsync({ oldName: renameTarget, newName: newCollectionName })
      notifications.show({
        title: 'Rename Successful',
        message: `Collection renamed to "${newCollectionName}"`,
        color: 'green',
      })
      setRenameModalOpened(false)
      if (currentCollection === renameTarget) {
        router.push(`/collections/${newCollectionName}`)
      }
    } catch (error) {
      notifications.show({ title: 'Rename Failed', message: (error as Error).message, color: 'red' })
    }
  }

  const handleDeleteClick = () => {
    if (!contextMenu) return
    const collectionName = contextMenu.collection
    setContextMenu(null)

    modals.openConfirmModal({
      title: 'Confirm Delete Collection',
      children: `Are you sure you want to delete collection "${collectionName}"? This action cannot be undone.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteCollectionMutation.mutateAsync(collectionName)
          notifications.show({
            title: 'Delete Successful',
            message: `Collection "${collectionName}" has been successfully deleted`,
            color: 'green',
          })
          if (currentCollection === collectionName) {
            router.push('/collections')
          }
        } catch (error) {
          notifications.show({ title: 'Delete Failed', message: (error as Error).message, color: 'red' })
        }
      },
    })
  }

  return (
    <>
      <div className={styles.sidebar}>
        <div className={styles.searchBox}>
          <input
            className={styles.searchInput}
            placeholder="Filter collections..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select className={styles.sortSelect} value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)}>
            <option value="alpha-asc">Sort: A-Z</option>
            <option value="alpha-desc">Sort: Z-A</option>
            <option value="recent">Sort: Recently viewed</option>
          </select>
        </div>
        <div
          className={styles.list}
          ref={listRef}
          onScroll={e => {
            if (typeof window === 'undefined') return
            window.localStorage.setItem(
              SIDEBAR_STATE_KEY,
              JSON.stringify({ filter, sortMode, scrollTop: e.currentTarget.scrollTop, recentlyViewed })
            )
          }}
        >
          {filtered.map(collection => (
            <div
              key={collection}
              className={`${styles.item} ${collection === currentCollection ? styles.itemActive : ''}`}
              onClick={() => handleClick(collection)}
              onContextMenu={e => handleContextMenu(e, collection)}
            >
              <IconTable size={14} stroke={1.5} />
              <span className={styles.itemName}>{collection}</span>
            </div>
          ))}
        </div>
      </div>

      {contextMenu && (
        <div ref={contextMenuRef} className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className={styles.contextMenuItem} onClick={handleRenameClick}>
            <IconEdit size={14} stroke={1.5} />
            Rename
          </div>
          <div className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`} onClick={handleDeleteClick}>
            <IconTrash size={14} stroke={1.5} />
            Delete
          </div>
        </div>
      )}

      <Modal
        opened={renameModalOpened}
        onClose={() => setRenameModalOpened(false)}
        title="Rename Collection"
        styles={{
          header: { backgroundColor: '#252526', borderBottom: '1px solid #3c3c3c' },
          body: { backgroundColor: '#252526' },
          content: { backgroundColor: '#252526' },
        }}
      >
        <TextInput
          label="New Name"
          placeholder="Enter new collection name"
          value={newCollectionName}
          onChange={e => setNewCollectionName(e.currentTarget.value)}
          data-autofocus
          styles={{
            input: { backgroundColor: '#3c3c3c', borderColor: '#3c3c3c', color: '#cccccc' },
            label: { color: '#cccccc' },
          }}
        />
        <Group mt="md" justify="flex-end">
          <Button
            variant="default"
            onClick={() => setRenameModalOpened(false)}
            styles={{ root: { backgroundColor: '#3c3c3c', borderColor: '#3c3c3c', color: '#cccccc' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRenameSubmit}
            loading={renameCollectionMutation.isPending}
            styles={{ root: { backgroundColor: '#007acc', borderColor: '#007acc' } }}
          >
            Confirm
          </Button>
        </Group>
      </Modal>
    </>
  )
}

export default CollectionSidebar
