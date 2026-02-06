# Implementation Log

## 2026-02-06

1. Read `spec.md` and identified scope for sidebar persistence/sorting and metadata filtering.
2. Added failing tests first for `where` filter propagation in:
   - `src/app/api/collections/[collectionName]/records/__tests__/route.test.ts`
   - `src/lib/server/__tests__/db.test.ts`
3. Implemented server-side metadata filtering support:
   - Route parsing/validation for `where` query param
   - `fetchRecords`/`countRecord` filter wiring for v1 and v2 DB adapters
4. Implemented front-end metadata filter controls in `DataToolbar` and query flow integration in `DataGrid` and query hooks.
5. Implemented sidebar state persistence and enhanced sorting:
   - persisted filter/sort/scroll/recently-viewed in localStorage
   - added sort selector (A-Z, Z-A, Recently viewed)
6. Added/updated styles for new controls.
