'use client'

import { useAtom, useAtomValue } from 'jotai'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

import { useGetCollectionRecords, useGetConfig } from '@/lib/client/query'
import { currentPageAtom, queryAtom } from '@/components/RecordPage/atom'

import styles from './index.module.scss'

const PAGE_SIZE = 20

const StatusBar = ({ collectionName }: { collectionName: string }) => {
  const query = useAtomValue(queryAtom)
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom)
  const { data: config } = useGetConfig()
  const { data: queryResult } = useGetCollectionRecords(config, collectionName, currentPage, query)

  const withQuery = !!query
  const total = queryResult && !('error' in queryResult) ? queryResult.total : 0
  const recordCount = queryResult && !('error' in queryResult) ? queryResult.records.length : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <span>
          Records: {recordCount}
          {!withQuery && total > 0 && ` of ${total}`}
        </span>
      </div>

      {!withQuery && (
        <div className={styles.center}>
          <button
            className={styles.pageBtn}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            <IconChevronLeft size={14} />
          </button>
          <span className={styles.pageInfo}>
            {currentPage} / {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      )}

      <div className={styles.right}>
        <span>{config?.connectionString}</span>
      </div>
    </div>
  )
}

export default StatusBar
