import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb'

enum IncludeEnum {
  Documents = 'documents',
  Embeddings = 'embeddings',
  Metadatas = 'metadatas',
  Distances = 'distances',
}

type Auth = {
  authType: string
  token: string
  username: string
  password: string
}

function formatAuth(auth: Auth) {
  if (auth.authType === 'token') {
    return {
      provider: 'token',
      credentials: auth.token,
    }
  } else if (auth.authType === 'basic') {
    return {
      provider: 'basic',
      credentials: {
        username: auth.username,
        password: auth.password,
      },
    }
  }
}

function v1Headers(auth: Auth): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth.authType === 'token' && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  } else if (auth.authType === 'basic' && auth.username) {
    headers['Authorization'] = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`
  }
  return headers
}

async function v1Fetch(url: string, auth: Auth, options: RequestInit = {}) {
  const headers = { ...v1Headers(auth), ...(options.headers as Record<string, string>) }
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch ${url} with status ${response.status}: ${text}`)
  }
  return response.json()
}

// ─── v1 API implementations (raw HTTP) ──────────────────────────────────────

async function v1FetchCollections(connectionString: string, auth: Auth, tenant: string, database: string) {
  return v1Fetch(`${connectionString}/api/v1/collections?tenant=${tenant}&database=${database}`, auth) as Promise<
    Array<{ name: string; id: string; metadata: any }>
  >
}

const PAGE_SIZE = 20

async function v1FetchRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  page: number,
  tenant: string,
  database: string
) {
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === collectionName)
  if (!collection) throw new Error(`Collection '${collectionName}' not found`)

  const data = await v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/get`, auth, {
    method: 'POST',
    body: JSON.stringify({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      include: ['documents', 'embeddings', 'metadatas'],
    }),
  })

  return data.ids.map((id: string, index: number) => ({
    id,
    document: data.documents?.[index],
    metadata: data.metadatas?.[index],
    embedding: data.embeddings?.[index],
  }))
}

async function v1CountRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string
) {
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === collectionName)
  if (!collection) throw new Error(`Collection '${collectionName}' not found`)

  return v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/count`, auth, {
    method: 'GET',
  })
}

const QUERY_K = 10

async function v1QueryRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryEmbeddings: number[],
  tenant: string,
  database: string
) {
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === collectionName)
  if (!collection) throw new Error(`Collection '${collectionName}' not found`)

  const data = await v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/query`, auth, {
    method: 'POST',
    body: JSON.stringify({
      query_embeddings: [queryEmbeddings],
      n_results: QUERY_K,
      include: ['documents', 'embeddings', 'metadatas', 'distances'],
    }),
  })

  if (data.error) throw new Error(data.error)

  return data.ids[0].map((id: string, index: number) => ({
    id,
    document: data.documents[0][index],
    metadata: data.metadatas[0][index],
    embedding: data.embeddings?.[0][index],
    distance: data.distances?.[0][index],
  }))
}

async function v1QueryRecordsText(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryTexts: string,
  tenant: string,
  database: string
) {
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === collectionName)
  if (!collection) throw new Error(`Collection '${collectionName}' not found`)

  const data = await v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/get`, auth, {
    method: 'POST',
    body: JSON.stringify({
      ids: [queryTexts],
      include: ['documents', 'embeddings', 'metadatas'],
    }),
  })

  if (data.error) throw new Error(data.error)
  if (data.ids.length === 0) throw new Error('RecordNotFound')

  return [
    {
      id: data.ids[0],
      document: data.documents[0],
      metadata: data.metadatas[0],
      embedding: data.embeddings?.[0],
      distance: 0,
    },
  ]
}

async function v1DeleteRecord(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  recordId: string,
  tenant: string,
  database: string
) {
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === collectionName)
  if (!collection) throw new Error(`Collection '${collectionName}' not found`)

  await v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/delete`, auth, {
    method: 'POST',
    body: JSON.stringify({ ids: [recordId] }),
  })

  return { success: true }
}

async function v1DeleteCollection(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string
) {
  await v1Fetch(
    `${connectionString}/api/v1/collections/${collectionName}?tenant=${tenant}&database=${database}`,
    auth,
    { method: 'DELETE' }
  )
  return { success: true }
}

async function v1UpdateCollection(
  connectionString: string,
  auth: Auth,
  oldName: string,
  newName: string,
  tenant: string,
  database: string
) {
  // v1 doesn't support rename directly, so we copy records to a new collection and delete the old
  const collections = await v1FetchCollections(connectionString, auth, tenant, database)
  const collection = collections.find(c => c.name === oldName)
  if (!collection) throw new Error(`Collection '${oldName}' not found`)

  // Get all records
  const records = await v1Fetch(`${connectionString}/api/v1/collections/${collection.id}/get`, auth, {
    method: 'POST',
    body: JSON.stringify({
      include: ['documents', 'embeddings', 'metadatas'],
    }),
  })

  // Create new collection
  await v1Fetch(`${connectionString}/api/v1/collections?tenant=${tenant}&database=${database}`, auth, {
    method: 'POST',
    body: JSON.stringify({ name: newName }),
  })

  // Get the new collection to find its ID
  const updatedCollections = await v1FetchCollections(connectionString, auth, tenant, database)
  const newCollection = updatedCollections.find(c => c.name === newName)
  if (!newCollection) throw new Error(`Failed to create collection '${newName}'`)

  // Add records to new collection
  if (records.ids.length > 0) {
    await v1Fetch(`${connectionString}/api/v1/collections/${newCollection.id}/add`, auth, {
      method: 'POST',
      body: JSON.stringify({
        ids: records.ids,
        documents: records.documents,
        embeddings: records.embeddings,
        metadatas: records.metadatas,
      }),
    })
  }

  // Delete old collection
  await v1Fetch(`${connectionString}/api/v1/collections/${oldName}?tenant=${tenant}&database=${database}`, auth, {
    method: 'DELETE',
  })

  return { success: true, newName }
}

// ─── v2 API implementations (chromadb client) ───────────────────────────────

async function v2FetchCollections(connectionString: string, auth: Auth, tenant: string, database: string) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })
  return client.listCollections()
}

async function v2FetchRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  page: number,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const collection = await client.getCollection({ name: collectionName, embeddingFunction })

  const response = await collection.get({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    include: [IncludeEnum.Documents, IncludeEnum.Embeddings, IncludeEnum.Metadatas],
  })

  return response.ids.map((id, index) => ({
    id,
    document: response.documents[index],
    metadata: response.metadatas[index],
    embedding: response.embeddings?.[index],
  }))
}

async function v2CountRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const collection = await client.getCollection({ name: collectionName, embeddingFunction })

  return collection.count()
}

async function v2QueryRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryEmbeddings: number[],
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const collection = await client.getCollection({ name: collectionName, embeddingFunction })

  type queryErrorResponse = { error: string }

  const response = await collection.query({
    queryEmbeddings: queryEmbeddings,
    nResults: QUERY_K,
    include: [IncludeEnum.Documents, IncludeEnum.Embeddings, IncludeEnum.Metadatas, IncludeEnum.Distances],
  })

  if ((response as unknown as queryErrorResponse)['error'] != null) {
    throw new Error((response as unknown as queryErrorResponse)['error'])
  }

  return response.ids[0].map((id, index) => ({
    id,
    document: response.documents[0][index],
    metadata: response.metadatas[0][index],
    embedding: response.embeddings?.[0][index],
    distance: response.distances?.[0][index],
  }))
}

async function v2QueryRecordsText(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryTexts: string,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const collection = await client.getCollection({ name: collectionName, embeddingFunction })

  type queryErrorResponse = { error: string }

  const response = await collection.get({
    ids: [queryTexts],
    include: [IncludeEnum.Documents, IncludeEnum.Embeddings, IncludeEnum.Metadatas],
  })

  if ((response as unknown as queryErrorResponse)['error'] != null) {
    throw new Error((response as unknown as queryErrorResponse)['error'])
  }

  if (response.ids.length === 0) throw new Error('RecordNotFound')

  return [
    {
      id: response.ids[0],
      document: response.documents[0],
      metadata: response.metadatas[0],
      embedding: response.embeddings?.[0],
      distance: 0,
    },
  ]
}

async function v2DeleteRecord(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  recordId: string,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const collection = await client.getCollection({ name: collectionName, embeddingFunction })

  await collection.delete({ ids: [recordId] })
  return { success: true }
}

async function v2DeleteCollection(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  await client.deleteCollection({ name: collectionName })
  return { success: true }
}

async function v2UpdateCollection(
  connectionString: string,
  auth: Auth,
  oldName: string,
  newName: string,
  tenant: string,
  database: string
) {
  const client = new ChromaClient({
    path: connectionString,
    auth: formatAuth(auth),
    database: database,
    tenant: tenant,
  })

  const embeddingFunction = new DefaultEmbeddingFunction()
  const oldCollection = await client.getCollection({ name: oldName, embeddingFunction })

  const records = await oldCollection.get({
    include: [IncludeEnum.Documents, IncludeEnum.Embeddings, IncludeEnum.Metadatas],
  })

  const newCollection = await client.createCollection({ name: newName, embeddingFunction })

  if (records.ids.length > 0) {
    const validDocuments = records.documents?.filter((doc): doc is string => doc !== null) || []
    const validEmbeddings = records.embeddings?.filter((emb): emb is number[] => emb !== null) || []
    const validMetadatas = records.metadatas?.filter((meta): meta is Record<string, any> => meta !== null) || []

    await newCollection.add({
      ids: records.ids,
      documents: validDocuments,
      embeddings: validEmbeddings,
      metadatas: validMetadatas,
    })
  }

  await client.deleteCollection({ name: oldName })
  return { success: true, newName }
}

// ─── Exported functions (dispatch by apiVersion) ────────────────────────────

export async function fetchCollections(
  connectionString: string,
  auth: Auth,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') {
    const collections = await v1FetchCollections(connectionString, auth, tenant, database)
    return collections.map(c => c.name)
  }
  return v2FetchCollections(connectionString, auth, tenant, database)
}

export async function fetchRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  page: number,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') return v1FetchRecords(connectionString, auth, collectionName, page, tenant, database)
  return v2FetchRecords(connectionString, auth, collectionName, page, tenant, database)
}

export async function queryRecords(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryEmbeddings: number[],
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1')
    return v1QueryRecords(connectionString, auth, collectionName, queryEmbeddings, tenant, database)
  return v2QueryRecords(connectionString, auth, collectionName, queryEmbeddings, tenant, database)
}

export async function queryRecordsText(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  queryTexts: string,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1')
    return v1QueryRecordsText(connectionString, auth, collectionName, queryTexts, tenant, database)
  return v2QueryRecordsText(connectionString, auth, collectionName, queryTexts, tenant, database)
}

export async function countRecord(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') return v1CountRecords(connectionString, auth, collectionName, tenant, database)
  return v2CountRecords(connectionString, auth, collectionName, tenant, database)
}

export async function deleteRecord(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  recordId: string,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') return v1DeleteRecord(connectionString, auth, collectionName, recordId, tenant, database)
  return v2DeleteRecord(connectionString, auth, collectionName, recordId, tenant, database)
}

export async function deleteCollection(
  connectionString: string,
  auth: Auth,
  collectionName: string,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') return v1DeleteCollection(connectionString, auth, collectionName, tenant, database)
  return v2DeleteCollection(connectionString, auth, collectionName, tenant, database)
}

export async function updateCollection(
  connectionString: string,
  auth: Auth,
  oldName: string,
  newName: string,
  tenant: string,
  database: string,
  apiVersion: string = 'v1'
) {
  if (apiVersion === 'v1') return v1UpdateCollection(connectionString, auth, oldName, newName, tenant, database)
  return v2UpdateCollection(connectionString, auth, oldName, newName, tenant, database)
}
