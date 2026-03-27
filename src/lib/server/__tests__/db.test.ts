import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ChromaClient } from 'chromadb'

import * as db from '../db'

// Mock the chromadb module for v2 API tests
vi.mock('chromadb', () => {
  return {
    ChromaClient: vi.fn(),
    DefaultEmbeddingFunction: vi.fn(),
  }
})

// Add fetch mock to global scope for v1 API tests
const originalFetch = global.fetch
const fetchMock = vi.fn()

beforeEach(() => {
  global.fetch = fetchMock
  // Reset ID cache before each test to ensure isolation
  // Since cache is module-level, we can't easily reset it without exposing a method,
  // but we can at least advance time or mock Date.now if needed.
  // For these tests, we'll just mock responses appropriately.
})

afterEach(() => {
  global.fetch = originalFetch
  vi.clearAllMocks()
})

const conn = 'http://localhost'
const AUTH = { authType: 'none', token: '', username: '', password: '' }
const TENANT = 'default_tenant'
const DB = 'default_database'

// Helper to mock successful fetch response
function jsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers(),
  } as Response)
}

function errorResponse(status: number, message: string) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(message),
    headers: new Headers(),
  } as Response)
}

describe('v1 API implementations (raw HTTP)', () => {
  describe('fetchRecords', () => {
    it('fetches collections list to populate cache, then fetches records', async () => {
      // 1. Mock collections list response
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'collection-1', metadata: null }]))
      // 2. Mock records response
      fetchMock.mockImplementationOnce(() => jsonResponse({ ids: ['r1'], documents: ['d1'], metadatas: [null] }))

      const result = await db.fetchRecords(conn, AUTH, 'collection-1', 1, TENANT, DB, 'v1')

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result).toEqual([{ id: 'r1', document: 'd1', metadata: null }])
    })

    it('passes where filter to post body', async () => {
      // Assume cache is already populated or mock it again
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce((url, options) => {
        const body = JSON.parse(options.body)
        expect(body.where).toEqual({ source: 'notion' })
        return jsonResponse({ ids: ['r1'], documents: ['d1'], metadatas: [null] })
      })

      await db.fetchRecords(conn, AUTH, 'docs', 1, TENANT, DB, 'v1', { source: 'notion' })
    })

    it('throws error if collection name not found in list', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([]))

      await expect(db.fetchRecords(conn, AUTH, 'nonexistent', 1, TENANT, DB, 'v1')).rejects.toThrow(
        "Collection 'nonexistent' not found"
      )
    })
  })

  describe('fetchRecordDetail', () => {
    it('fetches embeddings for a single record', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce((url, options) => {
        const body = JSON.parse(options.body)
        expect(body.ids).toEqual(['rec-123'])
        expect(body.include).toContain('embeddings')
        return jsonResponse({
          ids: ['rec-123'],
          documents: ['doc1'],
          metadatas: [{ a: 1 }],
          embeddings: [[0.1, 0.2]],
        })
      })

      const detail = await db.fetchRecordDetail(conn, AUTH, 'docs', 'rec-123', TENANT, DB, 'v1')

      expect(detail).toEqual({
        id: 'rec-123',
        document: 'doc1',
        metadata: { a: 1 },
        embedding: [0.1, 0.2],
      })
    })

    it('throws RecordNotFound if API returns empty ids', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() => jsonResponse({ ids: [], documents: [], metadatas: [] }))

      await expect(db.fetchRecordDetail(conn, AUTH, 'docs', 'missing', TENANT, DB, 'v1')).rejects.toThrow(
        'RecordNotFound'
      )
    })
  })

  describe('queryRecords (embedding query)', () => {
    it('sends query embeddings and returns distances', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() =>
        jsonResponse({
          ids: [['r1']],
          documents: [['d1']],
          metadatas: [[{}]],
          embeddings: [[[0.5, 0.5]]],
          distances: [[0.01]],
        })
      )

      const results = await db.queryRecords(conn, AUTH, 'docs', [0.1, 0.2], TENANT, DB, 'v1')

      expect(results).toHaveLength(1)
      expect(results[0].distance).toBe(0.01)
      expect(results[0].embedding).toEqual([0.5, 0.5])
    })

    it('throws error if API returns error (e.g., InvalidDimension)', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() => jsonResponse({ error: 'InvalidDimension' }))

      await expect(db.queryRecords(conn, AUTH, 'docs', [1.0], TENANT, DB, 'v1')).rejects.toThrow('InvalidDimension')
    })
  })

  describe('queryRecordsText (ID lookup)', () => {
    it('returns single record array when ID is found', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() =>
        jsonResponse({
          ids: ['my-id'],
          documents: ['doc'],
          metadatas: [null],
          embeddings: [[0.1]],
        })
      )

      const results = await db.queryRecordsText(conn, AUTH, 'docs', 'my-id', TENANT, DB, 'v1')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('my-id')
      expect(results[0].distance).toBe(0) // distance is 0 for ID lookups
    })

    it('throws RecordNotFound if ID does not exist', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() => jsonResponse({ ids: [], documents: [], metadatas: [], embeddings: [] }))

      await expect(db.queryRecordsText(conn, AUTH, 'docs', 'no-such-id', TENANT, DB, 'v1')).rejects.toThrow(
        'RecordNotFound'
      )
    })
  })

  describe('countRecord', () => {
    it('uses GET /count when no where filter is provided', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(42),
          headers: new Headers(),
        } as Response)
      ) // count returns plain number

      const count = await db.countRecord(conn, AUTH, 'docs', TENANT, DB, 'v1')

      expect(count).toBe(42)
      expect(fetchMock.mock.calls[1][0]).toContain('/count')
      expect(fetchMock.mock.calls[1][1].method).toBe('GET')
    })

    it('uses POST /get with where filter when provided and counts ids', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))
      fetchMock.mockImplementationOnce(() => jsonResponse({ ids: ['r1', 'r2', 'r3'] }))

      const count = await db.countRecord(conn, AUTH, 'docs', TENANT, DB, 'v1', { a: 1 })

      expect(count).toBe(3)
      expect(fetchMock.mock.calls[1][0]).toContain('/get')
      expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    })
  })

  describe('Authentication', () => {
    it('adds Bearer token header', async () => {
      fetchMock.mockImplementation(() => jsonResponse([]))
      const tokenAuth = { authType: 'token', token: 'my-token', username: '', password: '' }

      await db.fetchCollections(conn, tokenAuth, TENANT, DB, 'v1')

      const options = fetchMock.mock.calls[0][1]
      expect(options.headers['Authorization']).toBe('Bearer my-token')
    })

    it('adds Basic auth header', async () => {
      fetchMock.mockImplementation(() => jsonResponse([]))
      const basicAuth = { authType: 'basic', token: '', username: 'admin', password: 'password123' }

      await db.fetchCollections(conn, basicAuth, TENANT, DB, 'v1')

      const options = fetchMock.mock.calls[0][1]
      // base64 of admin:password123
      expect(options.headers['Authorization']).toBe('Basic YWRtaW46cGFzc3dvcmQxMjM=')
    })
  })

  describe('Redirects', () => {
    it('follows 301 redirects manually to preserve POST method', async () => {
      fetchMock.mockImplementationOnce(() => jsonResponse([{ id: 'uuid-1', name: 'docs', metadata: null }]))

      // Mock redirect response for the POST request
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 301,
          headers: new Headers({ location: 'http://localhost/redirected' }),
        } as Response)
      )

      // Mock successful response at redirected location
      fetchMock.mockImplementationOnce(() => jsonResponse({ success: true }))

      await db.deleteRecord(conn, AUTH, 'docs', 'r1', TENANT, DB, 'v1')

      expect(fetchMock).toHaveBeenCalledTimes(3)
      // Check the final fetch call
      const finalCallUrl = fetchMock.mock.calls[2][0]
      const finalCallOptions = fetchMock.mock.calls[2][1]
      expect(finalCallUrl).toBe('http://localhost/redirected')
      expect(finalCallOptions.method).toBe('POST') // method preserved
    })
  })
})

describe('v2 API implementations (chromadb client)', () => {
  beforeEach(() => {
    // Reset the ChromaClient mock
    vi.mocked(ChromaClient).mockClear()
  })

  it('fetchRecords uses ChromaClient collection.get()', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      ids: ['v2-r1'],
      documents: ['v2-d1'],
      metadatas: [{ source: 'v2' }],
    })

    const mockGetCollection = vi.fn().mockResolvedValue({
      get: mockGet,
    })

    vi.mocked(ChromaClient).mockImplementation(
      () =>
        ({
          getCollection: mockGetCollection,
        }) as any
    )

    const result = await db.fetchRecords(conn, AUTH, 'v2-collection', 1, TENANT, DB, 'v2')

    expect(ChromaClient).toHaveBeenCalled()
    expect(mockGetCollection).toHaveBeenCalledWith({
      name: 'v2-collection',
      embeddingFunction: expect.any(Object),
    })
    expect(mockGet).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        offset: 0,
      })
    )

    expect(result).toEqual([{ id: 'v2-r1', document: 'v2-d1', metadata: { source: 'v2' } }])
  })

  it('deleteCollection calls client.deleteCollection() directly', async () => {
    const mockDeleteCollection = vi.fn().mockResolvedValue(undefined)

    vi.mocked(ChromaClient).mockImplementation(
      () =>
        ({
          deleteCollection: mockDeleteCollection,
        }) as any
    )

    const result = await db.deleteCollection(conn, AUTH, 'bad-collection', TENANT, DB, 'v2')

    expect(mockDeleteCollection).toHaveBeenCalledWith({ name: 'bad-collection' })
    expect(result).toEqual({ success: true })
  })
})
