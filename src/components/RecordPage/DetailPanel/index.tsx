'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { IconX } from '@tabler/icons-react'

import { useGetConfig, useGetRecordDetail } from '@/lib/client/query'
import { selectedRecordAtom, detailPanelOpenAtom } from '@/components/RecordPage/atom'

import styles from './index.module.scss'

const DetailPanel = ({ collectionName }: { collectionName: string }) => {
  const selectedRecord = useAtomValue(selectedRecordAtom)
  const setDetailPanelOpen = useSetAtom(detailPanelOpenAtom)
  const { data: config } = useGetConfig()
  const { data: recordDetail, isLoading: isDetailLoading } = useGetRecordDetail(
    config,
    collectionName,
    selectedRecord?.id
  )

  const embedding = recordDetail?.embedding ?? selectedRecord?.embedding

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Record Detail</span>
        <button className={styles.closeBtn} onClick={() => setDetailPanelOpen(false)}>
          <IconX size={14} stroke={1.5} />
        </button>
      </div>

      {!selectedRecord ? (
        <div className={styles.emptyState}>Select a record to view details</div>
      ) : (
        <div className={styles.body}>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>ID</div>
            <div className={`${styles.fieldValue} ${styles.valueId}`}>{selectedRecord.id}</div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLabel}>Document</div>
            <div className={`${styles.fieldValue} ${styles.valueString}`}>{selectedRecord.document || '(empty)'}</div>
          </div>

          {selectedRecord.distance !== undefined && selectedRecord.distance !== null && (
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Distance</div>
              <div className={`${styles.fieldValue} ${styles.valueNumber}`}>{selectedRecord.distance.toFixed(8)}</div>
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.fieldLabel}>Metadata</div>
            {selectedRecord.metadata ? (
              Object.entries(selectedRecord.metadata).map(([key, value]) => (
                <div key={key} className={styles.metadataEntry}>
                  <span className={styles.valueKey}>{key}:</span>
                  <span className={typeof value === 'number' ? styles.valueNumber : styles.valueString}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))
            ) : (
              <div className={`${styles.fieldValue} ${styles.valueString}`}>(none)</div>
            )}
          </div>

          <div className={styles.field}>
            <div className={styles.fieldLabel}>Embedding</div>
            {isDetailLoading ? (
              <div className={styles.embeddingLoading}>Loading embedding...</div>
            ) : embedding ? (
              <>
                <div className={styles.embeddingDim}>{embedding.length} dimensions</div>
                <div className={styles.embeddingValues}>
                  [
                  {embedding
                    .slice(0, 20)
                    .map(v => v.toFixed(6))
                    .join(', ')}
                  {embedding.length > 20 ? ', ...' : ''}]
                </div>
              </>
            ) : (
              <div className={`${styles.fieldValue} ${styles.valueString}`}>(not available)</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default DetailPanel
