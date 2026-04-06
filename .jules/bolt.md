## 2024-05-18 - [Add React.memo() to `DetailPanel` and `DataGrid`]

**Learning:** `DataGrid` and `DetailPanel` use Jotai atoms. `DetailPanel` gets `selectedRecord` and `recordDetail` which triggers re-renders. `DataGrid` gets `selectedRecord` directly to apply selected class style. Selecting a row in `DataGrid` updates `selectedRecordAtom`, which causes `DataGrid` to re-render in its entirety, checking all 20 rows and updating classes.
**Action:** The table rows in `DataGrid` can be separated into a memoized `Row` component. By doing so, when `selectedRecordAtom` updates, we avoid re-rendering all rows. We can extract the table `tr` elements into a `<TableRow>` component wrapped with `React.memo()`. The parent `DataGrid` will still re-render because it reads `selectedRecordAtom`, but if we pass primitive props or memoized callbacks to `<TableRow>`, React can skip re-rendering rows that haven't changed their selection state.

## 2025-02-13 - [DataGrid Jotai Atom Re-renders]

**Learning:** Even if `DataGridRow` is memoized, if the parent `DataGrid` uses `useAtom(selectedRecordAtom)`, the entire `DataGrid` will still re-render when the selection changes, causing unchanged props to be evaluated for `DataGridRow`. This makes the O(N) re-render still occur at the parent level.
**Action:** Move `useAtomValue(selectedRecordAtom)` down into `DataGridRow` itself so each row can subscribe individually to the selection state and compute its own `isSelected`. Change the parent `DataGrid` to only use `useSetAtom(selectedRecordAtom)`. This turns an O(N) parent re-render into an O(1) row re-render (only the newly selected and unselected rows re-render). For edge cases where action handlers need atom values without subscribing (like `handleDeleteRecord`), use Jotai's `useStore().get(atom)`.

## 2024-06-25 - [Prevent Sibling Re-renders with Jotai Wrapper Components]

**Learning:** When a parent layout component (like `RecordPage`) subscribes to a UI toggle atom (like `detailPanelOpenAtom`) simply to conditionally render a child component, toggling that state causes an O(N) re-render of all sibling components (e.g., `DataGrid`, `DataToolbar`, `StatusBar`).
**Action:** Subscribe to UI toggle atoms inside a dedicated child wrapper component (e.g., `DetailPanelWrapper`) rather than the shared parent layout, and conditionally render the inner component from there. This keeps the re-render localized and prevents unnecessary sibling re-renders.
