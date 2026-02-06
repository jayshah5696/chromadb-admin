import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module before importing the route handlers
vi.mock('@/lib/server/db', () => ({
  fetchRecords: vi.fn(),
  fetchRecordDetail: vi.fn(),
  countRecord: vi.fn(),
  queryRecords: vi.fn(),
  queryRecordsText: vi.fn(),
  deleteRecord: vi.fn(),
}))

// Mock the params module
vi.mock('@/lib/server/params', () => ({
  extractConnectionString: vi.fn(() => 'http://localhost:8000'),
  extractAuth: vi.fn(() => ({ authType: 'token', token: 'test', username: '', password: '' })),
  extractTenant: vi.fn(() => 'default_tenant'),
  extractDatabase: vi.fn(() => 'default_database'),
  extractApiVersion: vi.fn(() => 'v1'),
}))

import { GET, POST, DELETE } from '../route'
import * as db from '@/lib/server/db'

const PARAMS = { params: { collectionName: 'test-collection' } }

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── GET handler tests ──────────────────────────────────────────────────────

describe('GET /api/collections/[collectionName]/records', () => {
  it('returns paginated records when no recordId', async () => {
    const mockRecords = [
      { id: 'r1', document: 'doc1', metadata: { source: 'a' } },
      { id: 'r2', document: 'doc2', metadata: { source: 'b' } },
    ]
    vi.mocked(db.fetchRecords).mockResolvedValue(mockRecords)
    vi.mocked(db.countRecord).mockResolvedValue(42)

    const request = makeRequest('http://localhost/api/collections/test-collection/records?page=2')
    const response = await GET(request, PARAMS)
    const data = await response.json()

    expect(data.total).toBe(42)
    expect(data.page).toBe(2)
    expect(data.records).toEqual(mockRecords)
  })

  it('passes parsed where filter to fetch/count for list requests', async () => {
    vi.mocked(db.fetchRecords).mockResolvedValue([])
    vi.mocked(db.countRecord).mockResolvedValue(0)

    const where = encodeURIComponent(JSON.stringify({ source: 'documentation', page: { $gte: 5 } }))
    const request = makeRequest(`http://localhost/api/collections/test-collection/records?page=1&where=${where}`)

    await GET(request, PARAMS)

    expect(db.fetchRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'test-collection',
      1,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { source: 'documentation', page: { $gte: 5 } }
    )
    expect(db.countRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'test-collection',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { source: 'documentation', page: { $gte: 5 } }
    )
  })

  it('defaults to page 1 when page param is missing', async () => {
    vi.mocked(db.fetchRecords).mockResolvedValue([])
    vi.mocked(db.countRecord).mockResolvedValue(0)

    const request = makeRequest('http://localhost/api/collections/test-collection/records')
    const response = await GET(request, PARAMS)
    const data = await response.json()

    expect(data.page).toBe(1)
  })

  it('returns single record detail when recordId is provided', async () => {
    const mockRecord = {
      id: 'rec-1',
      document: 'Hello',
      metadata: { source: 'test.txt' },
      embedding: [0.1, 0.2],
    }
    vi.mocked(db.fetchRecordDetail).mockResolvedValue(mockRecord)

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records?recordId=rec-1'
    )
    const response = await GET(request, PARAMS)
    const data = await response.json()

    expect(data.record).toEqual(mockRecord)
    expect(db.fetchRecords).not.toHaveBeenCalled()
    expect(db.countRecord).not.toHaveBeenCalled()
  })

  it('returns 500 on error', async () => {
    vi.mocked(db.fetchRecords).mockRejectedValue(new Error('Connection refused'))
    vi.mocked(db.countRecord).mockResolvedValue(0)

    const request = makeRequest('http://localhost/api/collections/test-collection/records')
    const response = await GET(request, PARAMS)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Connection refused')
  })
})

// ─── POST handler tests ─────────────────────────────────────────────────────

describe('POST /api/collections/[collectionName]/records', () => {
  it('queries by embedding array', async () => {
    const mockResults = [
      { id: 'r1', document: 'd1', metadata: {}, embedding: [0.1], distance: 0.01 },
    ]
    vi.mocked(db.queryRecords).mockResolvedValue(mockResults)

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: [0.5, 0.5, 0.5] }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await POST(request, PARAMS)
    const data = await response.json()

    expect(data.records).toEqual(mockResults)
    expect(db.queryRecords).toHaveBeenCalled()
    expect(db.queryRecordsText).not.toHaveBeenCalled()
  })

  it('queries by text string (ID lookup)', async () => {
    const mockResults = [
      { id: 'my-id', document: 'doc', metadata: {}, embedding: [0.1], distance: 0 },
    ]
    vi.mocked(db.queryRecordsText).mockResolvedValue(mockResults)

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: 'my-id' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await POST(request, PARAMS)
    const data = await response.json()

    expect(data.records).toEqual(mockResults)
    expect(db.queryRecordsText).toHaveBeenCalled()
    expect(db.queryRecords).not.toHaveBeenCalled()
  })

  it('parses comma-separated string as embedding floats', async () => {
    vi.mocked(db.queryRecords).mockResolvedValue([])

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: '0.1,0.2,0.3' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    await POST(request, PARAMS)

    // Should parse as float array and call queryRecords (not queryRecordsText)
    expect(db.queryRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'test-collection',
      [0.1, 0.2, 0.3],
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it('returns 400 for InvalidDimension error', async () => {
    vi.mocked(db.queryRecords).mockRejectedValue(new Error('InvalidDimension'))

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: [1.0] }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await POST(request, PARAMS)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain('Invalid dimension')
  })

  it('returns 404 for RecordNotFound error', async () => {
    vi.mocked(db.queryRecordsText).mockRejectedValue(new Error('RecordNotFound'))

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: 'nonexistent-id' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await POST(request, PARAMS)

    expect(response.status).toBe(404)
  })

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(db.queryRecords).mockRejectedValue(new Error('Unexpected'))

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'POST',
        body: JSON.stringify({ query: [1.0] }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await POST(request, PARAMS)

    expect(response.status).toBe(500)
  })
})

// ─── DELETE handler tests ───────────────────────────────────────────────────

describe('DELETE /api/collections/[collectionName]/records', () => {
  it('deletes a record by ID', async () => {
    vi.mocked(db.deleteRecord).mockResolvedValue({ success: true })

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'DELETE',
        body: JSON.stringify({ id: 'rec-to-delete' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await DELETE(request, PARAMS)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(db.deleteRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'test-collection',
      'rec-to-delete',
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it('returns 400 when record ID is missing', async () => {
    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await DELETE(request, PARAMS)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Record ID is required')
  })

  it('returns 500 on delete failure', async () => {
    vi.mocked(db.deleteRecord).mockRejectedValue(new Error('Delete failed'))

    const request = makeRequest(
      'http://localhost/api/collections/test-collection/records',
      {
        method: 'DELETE',
        body: JSON.stringify({ id: 'rec-1' }),
        headers: { 'Content-Type': 'application/json' },
      }
    )
    const response = await DELETE(request, PARAMS)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Delete failed')
  })
})
