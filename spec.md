# ChromaDB Admin UI Improvements Specification

## Current State

The ChromaDB Admin interface features a three-panel layout inspired by TablePlus:
- **Left sidebar** (240px): Searchable collection list with alphabetical sorting
- **Center data grid**: Dense table showing ID, Document, Metadata, and Embedding/Distance columns
- **Right detail panel** (320px): Selected record details

**Technical Foundation:**
- Built on Next.js 14 with Mantine UI v7, using Jotai for state management
- Supports both ChromaDB v1 (raw HTTP) and v2 (ChromaClient) APIs
- Implements 30s TTL caching for collection IDs and data
- Uses pagination with PAGE_SIZE=20 for record listing
- Features lazy embedding loading for performance optimization

### Current Issues Identified

1. **Collection sidebar state reset**: When clicking on any collection, the left sidebar resets its state (loses scroll position, filter text, etc.)
2. **Limited data filtering**: No way to filter table rows by metadata fields, despite ChromaDB's robust filtering capabilities

## Proposed Improvements

### 1. Enhanced Collection Sidebar Sorting

**Problem**: Collections are currently only sorted alphabetically, and there's no persistence of user preferences.

**ChromaDB API Limitations**:
- `list_collections()` doesn't support server-side sorting or pagination ([feature request #374](https://github.com/chroma-core/chroma/issues/374))
- Collection metadata doesn't include timestamps or record counts by default
- Sorting must be implemented client-side with available collection data

**Proposed Solution**: Client-side sorting with locally tracked usage patterns.

**Feasible Options**:
- A) **Alphabetical + Recent** (RECOMMENDED) - Current alphabetical sorting plus a "Recently Viewed" section using localStorage tracking
- B) **Simple sort toggle** - Switch between alphabetical A-Z and Z-A
- C) **Usage frequency** - Track collection access frequency in localStorage

**Technical Implementation**:
- Implement client-side sorting in `CollectionSidebar/index.tsx`
- Track collection access patterns in localStorage:
  ```javascript
  // Example tracking structure
  {
    "recentlyViewed": ["collection1", "collection2"],
    "accessCounts": {"collection1": 15, "collection2": 3}
  }
  ```
- Maintain compatibility with existing 30s collection cache TTL

### 2. Sidebar State Persistence

**Problem**: Clicking on any collection resets the left sidebar state (scroll position, expanded sections, etc.).

**Proposed Solution**: Maintain sidebar state when navigating between collections.

**Requirements**:
- Preserve scroll position when switching collections
- Maintain filter text in the search box
- Keep any expanded/collapsed states
- Preserve sort order selection

**Technical Implementation**:
- Store sidebar state in component state or localStorage
- Prevent sidebar re-rendering on collection navigation
- Use React refs to maintain scroll position

### 3. Data Grid Row Filtering

**Problem**: No way to filter the main data table by metadata attributes, despite ChromaDB's comprehensive filtering API support.

**ChromaDB API Support**: ChromaDB provides robust metadata filtering through `where` and `where_document` parameters with MongoDB-style operators:
- **Comparison operators**: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`
- **Logical operators**: `$and`, `$or` for complex filter combinations
- **Document content filtering**: `$contains` for full-text search within documents

**Proposed Solution**: Implement filtering controls that leverage ChromaDB's native filtering capabilities.

**Implementation Priority**:
- A) **Metadata-based filters** (HIGH) - Query builder using ChromaDB's `where` parameter with supported operators
- B) **Document content search** (MEDIUM) - Text search using `where_document` with `$contains`
- C) **Simple column filters** (LOW) - Client-side text filtering for ID patterns

**Technical Implementation**:
- Add `where` parameter to existing `fetchRecords` calls in `src/lib/server/db.ts`
- Modify v1/v2 API calls to include filter parameters:
  ```javascript
  // Example filter structure
  where: {
    "$and": [
      {"source": "documentation"},
      {"page": {"$gte": 5, "$lte": 10}}
    ]
  }
  ```
- Maintain pagination compatibility with filtered results

**UI Placement**: Above the data grid as an expandable filter panel to maintain consistency with existing admin interface patterns.

## Implementation Priority

### Phase 1: Foundation
1. Fix sidebar state persistence when navigating collections
2. Add basic collection sorting options

### Phase 2: Enhanced Filtering
1. Implement basic row filtering by metadata
2. Add simple text-based column filters

### Phase 3: Advanced Features
1. Advanced filter combinations
2. Saved filter presets
3. Enhanced sorting with usage analytics

## Technical Requirements

### Dependencies
- Current stack: Next.js 14, Mantine UI v7, Jotai, TanStack Query v5
- No new major dependencies required
- Leverage existing dual API support (v1 raw HTTP, v2 ChromaClient)

### ChromaDB API Integration
- **Filtering**: Use existing `where` and `where_document` parameters in `collection.get()` and `collection.query()` methods
- **Collection Management**: Work within `list_collections()` limitations (no server-side sorting/pagination)
- **Pagination**: Maintain current PAGE_SIZE=20 with filtering compatibility
- **Caching**: Preserve 30s TTL for collection IDs and implement cache invalidation for filtered results

### Performance Considerations
- Server-side filtering via ChromaDB's native `where` parameter (more efficient than client-side)
- Client-side collection sorting due to API limitations
- Maintain lazy embedding loading pattern for filtered results
- Consider filter result caching with appropriate TTL

## Success Metrics

- Reduced time to find specific collections (sidebar improvements)
- Reduced time to find specific records (filtering improvements)
- Improved user workflow efficiency when switching between collections
- No performance regression on existing operations

## Technical Context & Sources

### ChromaDB API Documentation
- [**Metadata Filtering**](https://docs.trychroma.com/docs/querying-collections/metadata-filtering) - Comprehensive guide to `where` parameter filtering with MongoDB-style operators
- [**Query and Get Data**](https://docs.trychroma.com/docs/querying-collections/query-and-get) - Official API reference for collection querying methods
- [**Collections API Reference**](https://docs.trychroma.com/reference/python/collection) - Python client documentation for collection operations

### Current Project Implementation
- **Database Layer**: `src/lib/server/db.ts` - Dual v1/v2 API support with 30s collection ID caching
- **Collection Sidebar**: `src/components/CollectionSidebar/index.tsx` - Client-side alphabetical sorting with context menu
- **Data Grid**: `src/components/RecordPage/DataGrid/index.tsx` - Pagination support with embedded action menu
- **State Management**: Jotai atoms in `src/components/RecordPage/atom.ts` for query, page, and record selection

### Related ChromaDB Issues & Features
- [**Collection Pagination Request #374**](https://github.com/chroma-core/chroma/issues/374) - Feature request for `list_collections()` pagination support
- [**Metadata Sorting Request #978**](https://github.com/chroma-core/chroma/issues/978) - Community discussion on result sorting by metadata fields

### Competitive Analysis
- [**chromadb-admin (flanker)**](https://github.com/flanker/chromadb-admin) - Original fork source, basic admin interface
- [**Chroma DB GUI**](https://github.com/thakkaryash94/chroma-ui) - Alternative community admin interface
- [**ChromaFlowStudio**](https://github.com/coffeecodeconverter/ChromaFlowStudio) - Python desktop GUI with visualizations
- [**VectorAdmin**](https://cookbook.chromadb.dev/) - Universal vector database management tool

### Key Technical Constraints
1. **No server-side collection sorting** - ChromaDB's `list_collections()` returns unordered results
2. **Similarity-first architecture** - Vector databases prioritize embedding similarity over traditional sorting
3. **Pagination limitations** - Collection listing doesn't support offset/limit parameters
4. **Rich filtering support** - Robust metadata querying with logical operators available

---

*This specification is grounded in ChromaDB v1/v2 API capabilities as of 2026 and will be updated based on upstream API changes and user feedback.*