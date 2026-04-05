'use client'

import { useAtomValue } from 'jotai'
import { ModalsProvider } from '@mantine/modals'

import StatusBar from './StatusBar'
import DetailPanel from './DetailPanel'
import DataToolbar from './DataToolbar'
import DataGrid from './DataGrid'

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
          <DetailPanel collectionName={collectionName} />
        </div>
        <StatusBar collectionName={collectionName} />
      </div>
    </ModalsProvider>
  )
}

export default RecordPage
