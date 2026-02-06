'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { IconDots, IconSearch, IconCopy, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'

import { useGetCollectionRecords, useGetConfig, useDeleteRecord } from '@/lib/client/query'
import { queryAtom, currentPageAtom, selectedRecordAtom } from '@/components/RecordPage/atom'

import styles from './index.module.scss'

import type { Record } from '@/lib/types'

const DataGrid = ({ collectionName }: { collectionName: string }) => {
  const query = useAtomValue(queryAtom)
  const currentPage = useAtomValue(currentPageAtom)
  const [selectedRecord, setSelectedRecord] = useAtom(selectedRecordAtom)
  const setQuery = useSetAtom(queryAtom)
  const setCurrentPage = useSetAtom(currentPageAtom)

  const { data: config } = useGetConfig()
  const { data: queryResult, isLoading } = useGetCollectionRecords(config, collectionName, currentPage, query)
  const deleteRecordMutation = useDeleteRecord(collectionName)

  const [actionMenu, setActionMenu] = useState<{ x: number; y: number; record: Record } | null>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  const withQuery = !!query

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenu(null)
      }
    }
    if (actionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [actionMenu])

  const handleRowClick = useCallback(
    (record: Record) => {
      setSelectedRecord(record)
    },
    [setSelectedRecord]
  )

  const handleActionClick = useCallback((e: React.MouseEvent, record: Record) => {
    e.stopPropagation()
    setActionMenu({ x: e.clientX, y: e.clientY, record })
  }, [])

  const handleQueryByRecord = () => {
    if (!actionMenu) return
    if (!actionMenu.record.embedding) {
      notifications.show({
        title: 'Unavailable',
        message: 'Select the record first to load its embedding, then try again.',
        color: 'yellow',
      })
      setActionMenu(null)
      return
    }
    setQuery(actionMenu.record.embedding.join(', '))
    setCurrentPage(1)
    setActionMenu(null)
  }

  const handleCopyId = () => {
    if (!actionMenu) return
    navigator.clipboard.writeText(actionMenu.record.id)
    notifications.show({ title: 'Copied', message: 'Record ID copied to clipboard', color: 'green' })
    setActionMenu(null)
  }

  const handleDeleteRecord = () => {
    if (!actionMenu) return
    const recordId = actionMenu.record.id
    setActionMenu(null)

    modals.openConfirmModal({
      title: 'Confirm Delete',
      children: `Are you sure you want to delete the record with ID "${recordId}"? This action cannot be undone.`,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteRecordMutation.mutateAsync(recordId)
          notifications.show({
            title: 'Delete Successful',
            message: 'Record has been successfully deleted',
            color: 'green',
          })
          if (selectedRecord?.id === recordId) {
            setSelectedRecord(null)
          }
        } catch (error) {
          notifications.show({ title: 'Delete Failed', message: (error as Error).message, color: 'red' })
        }
      },
    })
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow}>
            <div className={styles.skeletonCell} style={{ width: '15%' }} />
            <div className={styles.skeletonCell} style={{ width: '40%' }} />
            <div className={styles.skeletonCell} style={{ width: '25%' }} />
            <div className={styles.skeletonCell} style={{ width: '20%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (queryResult && 'error' in queryResult) {
    return <div className={styles.errorState}>{queryResult.error}</div>
  }

  if (!queryResult || queryResult.records.length === 0) {
    return <div className={styles.emptyState}>No records found</div>
  }

  return (
    <>
      <div className={styles.container}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th} style={{ width: 32 }}></th>
              <th className={styles.th} style={{ width: '15%' }}>
                ID
              </th>
              <th className={styles.th} style={{ width: withQuery ? '40%' : '35%' }}>
                Document
              </th>
              <th className={styles.th} style={{ width: '25%' }}>
                Metadata
              </th>
              {withQuery ? (
                <th className={styles.th} style={{ width: '20%' }}>
                  Distance
                </th>
              ) : (
                <th className={styles.th} style={{ width: '25%' }}>
                  Embedding
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {queryResult.records.map(record => (
              <tr
                key={record.id}
                className={`${styles.tr} ${selectedRecord?.id === record.id ? styles.trSelected : ''}`}
                onClick={() => handleRowClick(record)}
              >
                <td className={`${styles.td} ${styles.actionCell}`}>
                  <button className={styles.actionBtn} onClick={e => handleActionClick(e, record)}>
                    <IconDots size={14} stroke={1.5} />
                  </button>
                </td>
                <td className={`${styles.td} ${styles.tdId}`}>{record.id}</td>
                <td className={`${styles.td} ${styles.tdDocument}`}>{record.document}</td>
                <td className={`${styles.td} ${styles.tdMetadata}`}>
                  {record.metadata ? JSON.stringify(record.metadata) : ''}
                </td>
                {withQuery ? (
                  <td className={`${styles.td} ${styles.tdNumber}`}>{record.distance?.toFixed(6)}</td>
                ) : (
                  <td className={`${styles.td} ${styles.tdNumber}`}>
                    {record.embedding
                      ? `[${record.embedding.length}d] ${record.embedding.slice(0, 4).join(', ')}...`
                      : '\u2014'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionMenu && (
        <div ref={actionMenuRef} className={styles.actionMenu} style={{ left: actionMenu.x, top: actionMenu.y }}>
          <div className={styles.actionMenuItem} onClick={handleQueryByRecord}>
            <IconSearch size={14} stroke={1.5} />
            Query by this record
          </div>
          <div className={styles.actionMenuItem} onClick={handleCopyId}>
            <IconCopy size={14} stroke={1.5} />
            Copy ID
          </div>
          <div className={`${styles.actionMenuItem} ${styles.actionMenuDanger}`} onClick={handleDeleteRecord}>
            <IconTrash size={14} stroke={1.5} />
            Delete Record
          </div>
        </div>
      )}
    </>
  )
}

export default DataGrid
