import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchCollections,
  fetchRecords,
  fetchRecordDetail,
  queryRecords,
  queryRecordsText,
  countRecord,
  deleteRecord,
  deleteCollection,
  updateCollection,
} from '../db'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AUTH = { authType: 'token', token: 'test-token', username: '', password: '' }
const CONN = 'http://localhost:8000'
const TENANT = 'default_tenant'
const DB = 'default_database'

/** Build a minimal Response-like object that fetch returns */
function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

const COLLECTIONS_LIST = [
  { name: 'docs', id: 'col-id-docs', metadata: {} },
  { name: 'images', id: 'col-id-images', metadata: {} },
]

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks()
  // Reset module-level cache between tests by re-importing would be ideal,
  // but we can work around it by using unique connection strings per test
  // or accepting that cache persists (and testing that behavior).
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Collection ID cache tests ───────────────────────────────────────────────

describe('collection ID cache (v1)', () => {
  it('caches collection IDs and avoids redundant list calls', async () => {
    const mockFetch = vi.fn()
    // First call: list collections
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    // Second call: GET records for the resolved collection
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: ['r1'],
        documents: ['doc1'],
        metadatas: [{ source: 'a' }],
      })
    )
    // Third call: count (should reuse cached collection ID, no extra list call)
    mockFetch.mockResolvedValueOnce(jsonResponse(42))

    vi.stubGlobal('fetch', mockFetch)

    // Use unique connection string so cache is fresh
    const conn = 'http://cache-test-1:8000'

    await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')
    await countRecord(conn, AUTH, 'docs', TENANT, DB, 'v1')

    // Should be 3 calls total: listCollections, getRecords, count
    // NOT 4 (no second listCollections call)
    expect(mockFetch).toHaveBeenCalledTimes(3)

    // First call should be to list collections
    const firstCallUrl = mockFetch.mock.calls[0][0]
    expect(firstCallUrl).toContain('/api/v1/collections?')

    // Second call should be to get records using the cached collection ID
    const secondCallUrl = mockFetch.mock.calls[1][0]
    expect(secondCallUrl).toContain('/api/v1/collections/col-id-docs/get')
  })

  it('re-fetches collection list after cache TTL expires', async () => {
    vi.useFakeTimers()

    const mockFetch = vi.fn()
    // First round: list + get
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: ['r1'], documents: ['d1'], metadatas: [null] })
    )
    // After TTL: list again + get
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: ['r2'], documents: ['d2'], metadatas: [null] })
    )

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://cache-ttl-test:8000'

    await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Advance past the 30s TTL
    vi.advanceTimersByTime(31_000)

    await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')
    // Should have re-fetched collections list
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it('caches all collections from a single list response', async () => {
    const mockFetch = vi.fn()
    // List collections once
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    // Get for 'docs'
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: ['r1'], documents: ['d1'], metadatas: [null] })
    )
    // Get for 'images' (should NOT trigger another list call)
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: ['r2'], documents: ['d2'], metadatas: [null] })
    )

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://cache-all-test:8000'

    await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')
    await fetchRecords(conn, AUTH, 'images', 1, TENANT, DB, 'v1')

    // Only 3 calls: 1 list + 2 gets (not 2 lists)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('throws when collection is not found', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)

    const conn = 'http://cache-notfound:8000'

    await expect(
      fetchRecords(conn, AUTH, 'nonexistent', 1, TENANT, DB, 'v1')
    ).rejects.toThrow("Collection 'nonexistent' not found")
  })
})

// ─── v1 fetchRecords tests ───────────────────────────────────────────────────

describe('fetchRecords (v1)', () => {
  it('maps response to record objects without embeddings', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: ['id-1', 'id-2'],
        documents: ['Hello world', 'Foo bar'],
        metadatas: [{ source: 'file1.txt' }, { source: 'file2.txt' }],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://fetch-records-test:8000'

    const result = await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')

    expect(result).toEqual([
      { id: 'id-1', document: 'Hello world', metadata: { source: 'file1.txt' } },
      { id: 'id-2', document: 'Foo bar', metadata: { source: 'file2.txt' } },
    ])
  })

  it('sends correct pagination parameters', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: [], documents: [], metadatas: [] })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://fetch-pagination-test:8000'

    await fetchRecords(conn, AUTH, 'docs', 3, TENANT, DB, 'v1')

    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.limit).toBe(20)
    expect(body.offset).toBe(40) // (3-1) * 20
    expect(body.include).toEqual(['documents', 'metadatas'])
  })

  it('does not include embeddings in list view', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: [], documents: [], metadatas: [] })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://fetch-no-embed-test:8000'

    await fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1')

    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.include).not.toContain('embeddings')
  })
})

// ─── v1 fetchRecordDetail tests ──────────────────────────────────────────────

describe('fetchRecordDetail (v1)', () => {
  it('returns single record with embeddings', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: ['rec-1'],
        documents: ['Hello'],
        metadatas: [{ source: 'test.txt' }],
        embeddings: [[0.1, 0.2, 0.3]],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://detail-test:8000'

    const result = await fetchRecordDetail(conn, AUTH, 'docs', 'rec-1', TENANT, DB, 'v1')

    expect(result).toEqual({
      id: 'rec-1',
      document: 'Hello',
      metadata: { source: 'test.txt' },
      embedding: [0.1, 0.2, 0.3],
    })
  })

  it('includes embeddings in the request', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: ['rec-1'],
        documents: ['Hello'],
        metadatas: [null],
        embeddings: [[0.1]],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://detail-embed-test:8000'

    await fetchRecordDetail(conn, AUTH, 'docs', 'rec-1', TENANT, DB, 'v1')

    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.include).toContain('embeddings')
    expect(body.ids).toEqual(['rec-1'])
  })

  it('throws RecordNotFound when no results returned', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: [], documents: [], metadatas: [] })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://detail-notfound-test:8000'

    await expect(
      fetchRecordDetail(conn, AUTH, 'docs', 'missing', TENANT, DB, 'v1')
    ).rejects.toThrow('RecordNotFound')
  })
})

// ─── v1 queryRecords tests ───────────────────────────────────────────────────

describe('queryRecords (v1)', () => {
  it('queries by embedding and returns records with distances', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: [['r1', 'r2']],
        documents: [['doc1', 'doc2']],
        metadatas: [[{ source: 'a' }, { source: 'b' }]],
        embeddings: [[[0.1], [0.2]]],
        distances: [[0.01, 0.05]],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://query-embed-test:8000'

    const result = await queryRecords(conn, AUTH, 'docs', [0.5, 0.5], TENANT, DB, 'v1')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'r1',
      document: 'doc1',
      metadata: { source: 'a' },
      embedding: [0.1],
      distance: 0.01,
    })
  })

  it('sends query_embeddings wrapped in array', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        embeddings: [[]],
        distances: [[]],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://query-wrap-test:8000'

    await queryRecords(conn, AUTH, 'docs', [1.0, 2.0], TENANT, DB, 'v1')

    const queryCall = mockFetch.mock.calls[1]
    const body = JSON.parse(queryCall[1].body)
    expect(body.query_embeddings).toEqual([[1.0, 2.0]])
    expect(body.n_results).toBe(10)
  })

  it('throws on error response from chroma', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'InvalidDimension' })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://query-error-test:8000'

    await expect(
      queryRecords(conn, AUTH, 'docs', [1.0], TENANT, DB, 'v1')
    ).rejects.toThrow('InvalidDimension')
  })
})

// ─── v1 queryRecordsText tests ───────────────────────────────────────────────

describe('queryRecordsText (v1)', () => {
  it('fetches a record by ID string', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: ['my-id'],
        documents: ['My document'],
        metadatas: [{ source: 'src.txt' }],
        embeddings: [[0.1, 0.2]],
      })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://query-text-test:8000'

    const result = await queryRecordsText(conn, AUTH, 'docs', 'my-id', TENANT, DB, 'v1')

    expect(result).toEqual([
      {
        id: 'my-id',
        document: 'My document',
        metadata: { source: 'src.txt' },
        embedding: [0.1, 0.2],
        distance: 0,
      },
    ])
  })

  it('throws RecordNotFound when no IDs match', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ ids: [], documents: [], metadatas: [], embeddings: [] })
    )
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://query-text-notfound:8000'

    await expect(
      queryRecordsText(conn, AUTH, 'docs', 'no-such-id', TENANT, DB, 'v1')
    ).rejects.toThrow('RecordNotFound')
  })
})

// ─── v1 countRecord tests ────────────────────────────────────────────────────

describe('countRecord (v1)', () => {
  it('returns the count from the API', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(jsonResponse(150))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://count-test:8000'

    const count = await countRecord(conn, AUTH, 'docs', TENANT, DB, 'v1')
    expect(count).toBe(150)
  })

  it('calls the correct count endpoint', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(jsonResponse(0))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://count-endpoint-test:8000'

    await countRecord(conn, AUTH, 'docs', TENANT, DB, 'v1')

    const countCall = mockFetch.mock.calls[1]
    expect(countCall[0]).toContain('/api/v1/collections/col-id-docs/count')
    expect(countCall[1].method).toBe('GET')
  })
})

// ─── v1 deleteRecord tests ──────────────────────────────────────────────────

describe('deleteRecord (v1)', () => {
  it('sends delete request with record ID', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    mockFetch.mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://delete-test:8000'

    const result = await deleteRecord(conn, AUTH, 'docs', 'rec-to-delete', TENANT, DB, 'v1')

    expect(result).toEqual({ success: true })

    const deleteCall = mockFetch.mock.calls[1]
    expect(deleteCall[0]).toContain('/api/v1/collections/col-id-docs/delete')
    const body = JSON.parse(deleteCall[1].body)
    expect(body.ids).toEqual(['rec-to-delete'])
  })
})

// ─── v1 deleteCollection tests ──────────────────────────────────────────────

describe('deleteCollection (v1)', () => {
  it('calls DELETE on the collection endpoint', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://delete-col-test:8000'

    const result = await deleteCollection(conn, AUTH, 'my-collection', TENANT, DB, 'v1')

    expect(result).toEqual({ success: true })
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('/api/v1/collections/my-collection')
    expect(call[1].method).toBe('DELETE')
  })
})

// ─── v1 fetchCollections tests ──────────────────────────────────────────────

describe('fetchCollections (v1)', () => {
  it('returns collection names only', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://list-cols-test:8000'

    const result = await fetchCollections(conn, AUTH, TENANT, DB, 'v1')

    expect(result).toEqual(['docs', 'images'])
  })
})

// ─── v1 auth header tests ───────────────────────────────────────────────────

describe('v1 auth headers', () => {
  it('sends Bearer token for token auth', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://auth-token-test:8000'

    await fetchCollections(conn, AUTH, TENANT, DB, 'v1')

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Bearer test-token')
  })

  it('sends Basic auth header for basic auth', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://auth-basic-test:8000'

    const basicAuth = { authType: 'basic', token: '', username: 'user', password: 'pass' }
    await fetchCollections(conn, basicAuth, TENANT, DB, 'v1')

    const headers = mockFetch.mock.calls[0][1].headers
    const expected = `Basic ${Buffer.from('user:pass').toString('base64')}`
    expect(headers['Authorization']).toBe(expected)
  })
})

// ─── v1 redirect handling tests ─────────────────────────────────────────────

describe('v1 redirect handling', () => {
  it('follows 301 redirects preserving HTTP method', async () => {
    const mockFetch = vi.fn()
    // First call returns 301
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 301,
      headers: new Headers({ location: 'http://new-host:8000/api/v1/collections?tenant=t&database=d' }),
      text: async () => '',
      json: async () => ({}),
    } as unknown as Response)
    // Redirect follow
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://redirect-test:8000'

    const result = await fetchCollections(conn, AUTH, TENANT, DB, 'v1')

    expect(result).toEqual(['docs', 'images'])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

// ─── API version dispatch tests ─────────────────────────────────────────────

describe('API version dispatch', () => {
  it('defaults to v1 when apiVersion is omitted', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce(jsonResponse(COLLECTIONS_LIST))
    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://dispatch-default-test:8000'

    // omit apiVersion param (defaults to 'v1')
    const result = await fetchCollections(conn, AUTH, TENANT, DB)

    expect(result).toEqual(['docs', 'images'])
    const callUrl = mockFetch.mock.calls[0][0]
    expect(callUrl).toContain('/api/v1/collections')
  })
})
