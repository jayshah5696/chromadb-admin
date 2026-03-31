'use client'

import { useAtomValue } from 'jotai'
import { ModalsProvider } from '@mantine/modals'

import StatusBar from './StatusBar'
import DetailPanel from './DetailPanel'
import DataToolbar from './DataToolbar'
import DataGrid from './DataGrid'
import { detailPanelOpenAtom } from './atom'

// ⚡ Bolt Optimization:
// By extracting detailPanelOpenAtom into this wrapper component,
// toggling the detail panel only re-renders this wrapper instead of the entire RecordPage.
// This prevents unnecessary re-renders of DataGrid, DataToolbar, and StatusBar.
const DetailPanelWrapper = ({ collectionName }: { collectionName: string }) => {
  const detailPanelOpen = useAtomValue(detailPanelOpenAtom)
  if (!detailPanelOpen) return null
  return <DetailPanel collectionName={collectionName} />
}

const RecordPage = ({ collectionName }: { collectionName: string }) => {
  return (
    <ModalsProvider>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <DataToolbar />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <DataGrid collectionName={collectionName} />
          <DetailPanelWrapper collectionName={collectionName} />
        </div>
        <StatusBar collectionName={collectionName} />
      </div>
    </ModalsProvider>
  )
}

export default RecordPage
