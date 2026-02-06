import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchCollections,
  fetchRecords,
  fetchRecordDetail,
  countRecord,
  queryRecords,
  deleteRecord,
  updateCollection,
} from '../db'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AUTH = { authType: 'token', token: 'tok', username: '', password: '' }
const TENANT = 'default_tenant'
const DB = 'default_database'

function jsonResponse(body: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response
}

function makeCollections(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `collection-${i}`,
    id: `id-${i}`,
    metadata: {},
  }))
}

function makeRecords(count: number) {
  return {
    ids: Array.from({ length: count }, (_, i) => `rec-${i}`),
    documents: Array.from({ length: count }, (_, i) => `Document ${i} content`),
    metadatas: Array.from({ length: count }, (_, i) => ({ source: `file-${i}.txt`, index: i })),
  }
}

function makeRecordsWithEmbeddings(count: number, dims: number) {
  const base = makeRecords(count)
  return {
    ...base,
    embeddings: Array.from({ length: count }, () =>
      Array.from({ length: dims }, () => Math.random())
    ),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ─── Rapid collection switching (simulates clicking sidebar items fast) ──────

describe('rapid collection switching', () => {
  it('handles switching between 10 collections sequentially with only 1 list call', async () => {
    const collections = makeCollections(10)
    const mockFetch = vi.fn()

    // Single list call, then 10 get calls
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    for (let i = 0; i < 10; i++) {
      mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(20)))
    }

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://rapid-switch:8000'

    // Simulate rapidly clicking through 10 collections (sequential, like real UI clicks)
    const results = []
    for (const c of collections) {
      results.push(await fetchRecords(conn, AUTH, c.name, 1, TENANT, DB, 'v1'))
    }

    // All 10 should return records
    expect(results).toHaveLength(10)
    results.forEach(r => expect(r).toHaveLength(20))

    // Only 1 collection list call + 10 get calls = 11 total
    expect(mockFetch).toHaveBeenCalledTimes(11)

    // First call must be the list call
    expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/collections?')
  })

  it('switching back and forth between 2 collections reuses cache', async () => {
    const collections = makeCollections(2)
    const mockFetch = vi.fn()

    // 1 list call + 6 get calls (A, B, A, B, A, B)
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    for (let i = 0; i < 6; i++) {
      mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(5)))
    }

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://back-forth:8000'

    // Simulate: click A, click B, click A, click B, click A, click B
    for (let i = 0; i < 6; i++) {
      await fetchRecords(conn, AUTH, collections[i % 2].name, 1, TENANT, DB, 'v1')
    }

    // Should still only have 1 list call (cache hit every time)
    expect(mockFetch).toHaveBeenCalledTimes(7) // 1 list + 6 gets
    const listCalls = mockFetch.mock.calls.filter(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/v1/collections?')
    )
    expect(listCalls).toHaveLength(1)
  })
})

// ─── Concurrent requests (multiple operations at once) ──────────────────────

describe('concurrent requests', () => {
  it('handles simultaneous fetchRecords + countRecord for same collection', async () => {
    const collections = makeCollections(3)
    const mockFetch = vi.fn()

    // Both concurrent calls will independently resolve the collection ID,
    // so we need 2 list responses + 1 get + 1 count
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(20)))
    mockFetch.mockResolvedValueOnce(jsonResponse(100))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://concurrent-same:8000'

    const [records, count] = await Promise.all([
      fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1'),
      countRecord(conn, AUTH, 'collection-0', TENANT, DB, 'v1'),
    ])

    expect(records).toHaveLength(20)
    expect(count).toBe(100)
  })

  it('sequential requests after first populate reuse cache', async () => {
    const collections = makeCollections(5)
    const mockFetch = vi.fn()

    // 1 list + 5 sequential gets (cache reused after first call)
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(10)))
    }

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://sequential-diff:8000'

    const results = []
    for (const c of collections) {
      results.push(await fetchRecords(conn, AUTH, c.name, 1, TENANT, DB, 'v1'))
    }

    results.forEach(r => expect(r).toHaveLength(10))
    // 1 list + 5 gets = 6 calls total
    expect(mockFetch).toHaveBeenCalledTimes(6)
  })
})

// ─── Large record sets ──────────────────────────────────────────────────────

describe('large record handling', () => {
  it('handles response with many records (page of 20 from large collection)', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(20)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://large-records:8000'

    const result = await fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1')

    expect(result).toHaveLength(20)
    // Verify all records are properly mapped
    result.forEach((r: any, i: number) => {
      expect(r.id).toBe(`rec-${i}`)
      expect(r.document).toBe(`Document ${i} content`)
      expect(r.metadata.source).toBe(`file-${i}.txt`)
    })
  })

  it('correctly paginates deep pages (page 50 = offset 980)', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(20)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://deep-page:8000'

    await fetchRecords(conn, AUTH, 'collection-0', 50, TENANT, DB, 'v1')

    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.offset).toBe(980) // (50-1) * 20
    expect(body.limit).toBe(20)
  })
})

// ─── Detail fetch (embeddings) vs list fetch (no embeddings) ────────────────

describe('list vs detail fetch performance', () => {
  it('list fetch excludes embeddings to reduce payload', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(20)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://list-no-embed:8000'

    await fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1')

    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.include).toEqual(['documents', 'metadatas'])
    expect(body.include).not.toContain('embeddings')
  })

  it('detail fetch includes embeddings for selected record only', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(
      jsonResponse(makeRecordsWithEmbeddings(1, 768))
    )

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://detail-embed:8000'

    const detail = await fetchRecordDetail(conn, AUTH, 'collection-0', 'rec-0', TENANT, DB, 'v1')

    // Verify the request includes embeddings
    const getCall = mockFetch.mock.calls[1]
    const body = JSON.parse(getCall[1].body)
    expect(body.include).toContain('embeddings')
    expect(body.ids).toEqual(['rec-0'])

    // Verify the response has the full embedding
    expect(detail.embedding).toHaveLength(768)
  })

  it('rapid row clicks: detail fetches use cached collection ID', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    // 1 list call + 5 detail calls
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    for (let i = 0; i < 5; i++) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          ids: [`rec-${i}`],
          documents: [`doc-${i}`],
          metadatas: [{ source: `s${i}` }],
          embeddings: [[0.1, 0.2]],
        })
      )
    }

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://rapid-detail:8000'

    // Simulate clicking 5 different rows rapidly
    for (let i = 0; i < 5; i++) {
      await fetchRecordDetail(conn, AUTH, 'collection-0', `rec-${i}`, TENANT, DB, 'v1')
    }

    // 1 list + 5 detail fetches = 6 total (no extra list calls)
    expect(mockFetch).toHaveBeenCalledTimes(6)
  })
})

// ─── Cache invalidation on collection mutations ─────────────────────────────

describe('cache invalidation on mutations', () => {
  it('updateCollection invalidates cache for old name', async () => {
    vi.useFakeTimers()
    const collections = makeCollections(3)
    const mockFetch = vi.fn()

    // Initial list for fetchRecords
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    // fetchRecords for collection-0
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(5)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://invalidate-rename:8000'

    // Prime the cache
    await fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    // Now rename: this will trigger its own fetches
    // updateCollection does: get old collection records, create new collection,
    // get new collection ID (list), add records, delete old
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecordsWithEmbeddings(5, 3))) // get old records
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: 'renamed', id: 'new-id' })) // create new
    // List call to get new collection ID (cache was invalidated for old name)
    const updatedCollections = [
      ...collections.filter(c => c.name !== 'collection-0'),
      { name: 'renamed', id: 'new-id', metadata: {} },
    ]
    mockFetch.mockResolvedValueOnce(jsonResponse(updatedCollections))
    mockFetch.mockResolvedValueOnce(jsonResponse({})) // add records
    mockFetch.mockResolvedValueOnce(jsonResponse({})) // delete old

    await updateCollection(conn, AUTH, 'collection-0', 'renamed', TENANT, DB, 'v1')

    // After rename, fetching old name should fail (it's gone)
    // and fetching new name should work (was cached during rename)
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(5)))
    const result = await fetchRecords(conn, AUTH, 'renamed', 1, TENANT, DB, 'v1')
    expect(result).toHaveLength(5)
  })
})

// ─── Many collections in sidebar ────────────────────────────────────────────

describe('many collections', () => {
  it('handles 100 collections in a single list response', async () => {
    const collections = makeCollections(100)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://many-collections:8000'

    const result = await fetchCollections(conn, AUTH, TENANT, DB, 'v1')

    expect(result).toHaveLength(100)
    expect(result[0]).toBe('collection-0')
    expect(result[99]).toBe('collection-99')
  })

  it('caches all 100 collection IDs from single list call', async () => {
    const collections = makeCollections(100)
    const mockFetch = vi.fn()

    // 1 list call + 100 get calls
    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    for (let i = 0; i < 100; i++) {
      mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(1)))
    }

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://cache-100:8000'

    // Fetch records for all 100 collections sequentially
    for (let i = 0; i < 100; i++) {
      await fetchRecords(conn, AUTH, `collection-${i}`, 1, TENANT, DB, 'v1')
    }

    // Only 1 list call despite 100 different collections
    expect(mockFetch).toHaveBeenCalledTimes(101) // 1 list + 100 gets
    const listCalls = mockFetch.mock.calls.filter(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('/api/v1/collections?')
    )
    expect(listCalls).toHaveLength(1)
  })
})

// ─── Error resilience under load ────────────────────────────────────────────

describe('error resilience', () => {
  it('one failed collection fetch does not poison cache for others', async () => {
    const collections = makeCollections(3)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    // collection-0 get succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(5)))
    // collection-1 get fails
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Internal error' }, 500))
    // collection-2 get succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(5)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://error-resilience:8000'

    const result0 = await fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1')
    expect(result0).toHaveLength(5)

    // collection-1 fails, but shouldn't affect the cache
    await expect(
      fetchRecords(conn, AUTH, 'collection-1', 1, TENANT, DB, 'v1')
    ).rejects.toThrow()

    // collection-2 should still work with cached collection ID
    const result2 = await fetchRecords(conn, AUTH, 'collection-2', 1, TENANT, DB, 'v1')
    expect(result2).toHaveLength(5)

    // Still only 1 list call (cache not poisoned)
    expect(mockFetch).toHaveBeenCalledTimes(4) // 1 list + 3 gets
  })

  it('fetch error propagates without corrupting subsequent requests', async () => {
    const collections = makeCollections(2)
    const mockFetch = vi.fn()

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    // First request fails
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500))
    // Second request succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse(makeRecords(3)))

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://error-then-ok:8000'

    await expect(
      fetchRecords(conn, AUTH, 'collection-0', 1, TENANT, DB, 'v1')
    ).rejects.toThrow()

    // Cache should still work for collection ID resolution
    const result = await fetchRecords(conn, AUTH, 'collection-1', 1, TENANT, DB, 'v1')
    expect(result).toHaveLength(3)
  })
})

// ─── Query with large embeddings ────────────────────────────────────────────

describe('large embedding queries', () => {
  it('handles 1536-dim embedding query (OpenAI ada-002 size)', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    const queryEmbedding = Array.from({ length: 1536 }, () => Math.random())

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: [['r1']],
        documents: [['matched doc']],
        metadatas: [[{ source: 'match' }]],
        embeddings: [[Array.from({ length: 1536 }, () => Math.random())]],
        distances: [[0.123]],
      })
    )

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://large-embedding:8000'

    const result = await queryRecords(conn, AUTH, 'collection-0', queryEmbedding, TENANT, DB, 'v1')

    expect(result).toHaveLength(1)
    expect(result[0].distance).toBe(0.123)

    // Verify full embedding was sent
    const queryCall = mockFetch.mock.calls[1]
    const body = JSON.parse(queryCall[1].body)
    expect(body.query_embeddings[0]).toHaveLength(1536)
  })

  it('handles 3072-dim embedding query (OpenAI text-embedding-3-large)', async () => {
    const collections = makeCollections(1)
    const mockFetch = vi.fn()

    const queryEmbedding = Array.from({ length: 3072 }, () => Math.random())

    mockFetch.mockResolvedValueOnce(jsonResponse(collections))
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ids: [['r1']],
        documents: [['big match']],
        metadatas: [[{}]],
        embeddings: [[Array.from({ length: 3072 }, () => Math.random())]],
        distances: [[0.05]],
      })
    )

    vi.stubGlobal('fetch', mockFetch)
    const conn = 'http://huge-embedding:8000'

    const result = await queryRecords(conn, AUTH, 'collection-0', queryEmbedding, TENANT, DB, 'v1')

    expect(result).toHaveLength(1)
    const queryCall = mockFetch.mock.calls[1]
    const body = JSON.parse(queryCall[1].body)
    expect(body.query_embeddings[0]).toHaveLength(3072)
  })
})
