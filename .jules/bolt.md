## 2024-05-18 - [Add React.memo() to `DetailPanel` and `DataGrid`]

**Learning:** `DataGrid` and `DetailPanel` use Jotai atoms. `DetailPanel` gets `selectedRecord` and `recordDetail` which triggers re-renders. `DataGrid` gets `selectedRecord` directly to apply selected class style. Selecting a row in `DataGrid` updates `selectedRecordAtom`, which causes `DataGrid` to re-render in its entirety, checking all 20 rows and updating classes.
**Action:** The table rows in `DataGrid` can be separated into a memoized `Row` component. By doing so, when `selectedRecordAtom` updates, we avoid re-rendering all rows. We can extract the table `tr` elements into a `<TableRow>` component wrapped with `React.memo()`. The parent `DataGrid` will still re-render because it reads `selectedRecordAtom`, but if we pass primitive props or memoized callbacks to `<TableRow>`, React can skip re-rendering rows that haven't changed their selection state.

## 2025-02-13 - [DataGrid Jotai Atom Re-renders]

**Learning:** Even if `DataGridRow` is memoized, if the parent `DataGrid` uses `useAtom(selectedRecordAtom)`, the entire `DataGrid` will still re-render when the selection changes, causing unchanged props to be evaluated for `DataGridRow`. This makes the O(N) re-render still occur at the parent level.
**Action:** Move `useAtomValue(selectedRecordAtom)` down into `DataGridRow` itself so each row can subscribe individually to the selection state and compute its own `isSelected`. Change the parent `DataGrid` to only use `useSetAtom(selectedRecordAtom)`. This turns an O(N) parent re-render into an O(1) row re-render (only the newly selected and unselected rows re-render). For edge cases where action handlers need atom values without subscribing (like `handleDeleteRecord`), use Jotai's `useStore().get(atom)`.

## 2026-04-03 - [UI Toggle Atom Anti-pattern]

**Learning:** In React/Jotai, reading a UI toggle atom (like `detailPanelOpenAtom`) in a parent component (like `RecordPage`) to conditionally render a child causes the entire parent tree to re-render whenever the toggle state changes. In this codebase, that caused `DataGrid` (and its potentially hundreds of memoized rows) to undergo O(N) evaluation just because a side panel was opened or closed.
**Action:** Move the `useAtomValue` subscription into a wrapper around the child component (`DetailPanelWrapper`) and conditionally render the inner content there. This isolates the re-render to the wrapper component, keeping sibling components (`DataGrid`, `StatusBar`, etc.) completely undisturbed when the UI state toggles.
