# ChromaDB Admin

A professional, dark-themed admin UI for the [Chroma](https://docs.trychroma.com) embedding database, built with Next.js. Inspired by [TablePlus](https://tableplus.com/).

> Forked from [flanker/chromadb-admin](https://github.com/flanker/chromadb-admin)

## What's Changed (This Fork)

### TablePlus-Inspired UI Rewrite

The entire frontend has been rewritten with a three-panel layout inspired by TablePlus and VS Code:

- **Dark theme** with a VSCode/TablePlus-inspired color palette
- **Left sidebar** (240px) — searchable collection list with right-click context menu (rename/delete)
- **Center data grid** — dense table with 28px rows, color-coded columns (ID, Document, Numbers), row selection, and context actions
- **Right detail panel** (320px) — vertical key-value view of selected record with color-coded values, metadata breakdown, and embedding preview
- **Status bar** (24px) — record count, pagination, and connection info
- **Compact toolbar** — segmented mode toggle (Vector/ID vs Text), monospace search input

### API Version Support (v1 / v2)

ChromaDB servers come in two API flavors:

| Version | URL Pattern | Notes |
|---------|-------------|-------|
| **v1** (legacy) | `/api/v1/collections/...` | Older Chroma servers |
| **v2** (current) | `/api/v2/tenants/{tenant}/databases/{db}/collections/...` | ChromaDB 0.4+ |

This fork lets you select the API version on the Setup page. The v1 implementation uses raw HTTP calls (bypassing the `chromadb` npm client which only supports v2).

### Performance Improvements

Several changes target navigation speed and reduced network overhead when working with large collections:

- **Collection ID cache (30s TTL)** — The v1 API requires resolving collection names to UUIDs before every operation. A module-level cache stores all collection IDs from a single list response, so switching between collections in the sidebar doesn't trigger redundant list calls. The cache auto-expires after 30 seconds.
- **Lazy embedding loading** — List view (`fetchRecords`) only requests `documents` and `metadatas`. Embeddings (which can be 1536-3072 floats per record) are fetched on-demand via `fetchRecordDetail` when a row is clicked, reducing list payload size significantly.
- **React Query `staleTime: 30_000`** — Collection records and record details are considered fresh for 30 seconds, preventing refetches when navigating back to a previously viewed collection or re-selecting a row.
- **Cache-aware collection rename** — `updateCollection` invalidates the old collection name from the ID cache so stale entries don't cause errors after rename operations.
- **301 redirect handling** — `v1Fetch` follows redirects while preserving the HTTP method (POST stays POST), avoiding silent failures with proxied ChromaDB deployments.

### Testing

Tests use [Vitest](https://vitest.dev/) and cover the server-side API layer and route handlers.

```bash
npm test            # single run
npm run test:watch  # watch mode
```

**Test suites (53 tests):**

| Suite | Tests | What it covers |
|-------|-------|----------------|
| `db.test.ts` | 24 | Collection ID cache (TTL, key generation, bulk caching, invalidation), `fetchRecords` pagination and record mapping, `fetchRecordDetail` with embeddings, `queryRecords` embedding queries, `queryRecordsText` ID lookup, `countRecord`, `deleteRecord`, `deleteCollection`, auth headers (Bearer/Basic), 301 redirect following, API version dispatch |
| `db.perf.test.ts` | 16 | Rapid collection switching (10 collections, 1 list call), back-and-forth navigation cache reuse, concurrent request handling, large record pagination (page 50), list vs detail fetch payload differences, rapid row click cache reuse, cache invalidation on rename, 100-collection bulk caching, error resilience (failed fetches don't poison cache), large embedding queries (1536d and 3072d) |
| `route.test.ts` | 13 | GET handler (paginated listing, single record detail, error handling), POST handler (embedding array query, text/ID query, comma-separated float parsing, InvalidDimension/RecordNotFound/500 errors), DELETE handler (success, missing ID validation, failure) |

### Tech Stack

- **Next.js 14** (App Router)
- **Mantine UI v7** with forced dark color scheme
- **Jotai** for client state
- **TanStack Query v5** for server state
- **SCSS Modules** for component styling
- **Inter** (UI) + **JetBrains Mono** (data) fonts

## Links

- Original repo: [flanker/chromadb-admin](https://github.com/flanker/chromadb-admin)
- Chroma docs: [docs.trychroma.com](https://docs.trychroma.com)

## Authentication Support

Supports Token (Bearer) and Basic authentication, configured on the Setup page.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser. You'll be redirected to `/setup` to configure your connection.

## Run with Docker

```bash
docker run -p 3001:3001 fengzhichao/chromadb-admin
```

Visit http://localhost:3001 in the browser.

*NOTE*: Use `http://host.docker.internal:8000` for the connection string if you want to connect to a ChromaDB instance running locally.

## Build and Run with Docker Locally

```bash
docker build -t chromadb-admin .
docker run -p 3001:3001 chromadb-admin
```

## Project Structure

```
src/
  app/
    layout.tsx              # Root layout (dark theme, fonts)
    page.tsx                # Root redirect (-> /collections or /setup)
    setup/page.tsx          # Connection setup (incl. API version selector)
    collections/
      [name]/layout.tsx     # Three-panel layout shell
      [name]/page.tsx       # RecordPage wrapper
      (withOutName)/        # No-collection-selected states
    api/
      collections/route.ts  # Collections CRUD API
      collections/[collectionName]/records/route.ts  # Records API
      embedding/route.ts    # Embedding proxy (OpenAI/Ollama/LM Studio)
  components/
    CollectionSidebar/      # Left panel - collection list
    RecordPage/
      DataToolbar/          # Search bar + mode toggle
      DataGrid/             # Main data table
      DetailPanel/          # Right panel - record detail view
      StatusBar/            # Bottom status bar
      atom.ts               # Jotai atoms
      index.tsx             # Composition root
  lib/
    client/
      query.ts              # React Query hooks
      localstorage.ts       # Config persistence
    server/
      db.ts                 # Database layer (v1 raw HTTP + v2 ChromaClient)
      params.ts             # Request parameter extraction
    types.ts                # TypeScript types
```

## Note

This is NOT an official Chroma project.

This project is licensed under the terms of the MIT license.
