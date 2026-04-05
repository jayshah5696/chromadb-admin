## 2024-05-18 - [Add React.memo() to `DetailPanel` and `DataGrid`]

**Learning:** `DataGrid` and `DetailPanel` use Jotai atoms. `DetailPanel` gets `selectedRecord` and `recordDetail` which triggers re-renders. `DataGrid` gets `selectedRecord` directly to apply selected class style. Selecting a row in `DataGrid` updates `selectedRecordAtom`, which causes `DataGrid` to re-render in its entirety, checking all 20 rows and updating classes.
**Action:** The table rows in `DataGrid` can be separated into a memoized `Row` component. By doing so, when `selectedRecordAtom` updates, we avoid re-rendering all rows. We can extract the table `tr` elements into a `<TableRow>` component wrapped with `React.memo()`. The parent `DataGrid` will still re-render because it reads `selectedRecordAtom`, but if we pass primitive props or memoized callbacks to `<TableRow>`, React can skip re-rendering rows that haven't changed their selection state.

## 2025-02-13 - [DataGrid Jotai Atom Re-renders]

**Learning:** Even if `DataGridRow` is memoized, if the parent `DataGrid` uses `useAtom(selectedRecordAtom)`, the entire `DataGrid` will still re-render when the selection changes, causing unchanged props to be evaluated for `DataGridRow`. This makes the O(N) re-render still occur at the parent level.
**Action:** Move `useAtomValue(selectedRecordAtom)` down into `DataGridRow` itself so each row can subscribe individually to the selection state and compute its own `isSelected`. Change the parent `DataGrid` to only use `useSetAtom(selectedRecordAtom)`. This turns an O(N) parent re-render into an O(1) row re-render (only the newly selected and unselected rows re-render). For edge cases where action handlers need atom values without subscribing (like `handleDeleteRecord`), use Jotai's `useStore().get(atom)`.

## 2026-04-05 - [DetailPanel Toggle Re-renders Parent]

**Learning:** Conditional rendering of large components using Jotai atoms at the parent level (e.g. `RecordPage` reading `detailPanelOpenAtom`) causes the entire layout (and all sibling components like `DataGrid`, `DataToolbar`) to re-render when the toggle state changes.
**Action:** Move the toggle state subscription inside a wrapper of the conditionally rendered component itself. The parent should unconditionally render the component (e.g. `<DetailPanel />`), and the inner wrapper component uses `useAtomValue` to return `null` when logically closed. This prevents sibling components from unnecessary re-renders when toggling visibility.