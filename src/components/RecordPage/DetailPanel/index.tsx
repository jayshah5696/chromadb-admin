'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { IconX } from '@tabler/icons-react'

import { selectedRecordAtom, detailPanelOpenAtom } from '@/components/RecordPage/atom'

import styles from './index.module.scss'

const DetailPanel = () => {
  const selectedRecord = useAtomValue(selectedRecordAtom)
  const setDetailPanelOpen = useSetAtom(detailPanelOpenAtom)

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
            <div className={styles.embeddingDim}>{selectedRecord.embedding.length} dimensions</div>
            <div className={styles.embeddingValues}>
              [
              {selectedRecord.embedding
                .slice(0, 20)
                .map(v => v.toFixed(6))
                .join(', ')}
              {selectedRecord.embedding.length > 20 ? ', ...' : ''}]
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetailPanel
