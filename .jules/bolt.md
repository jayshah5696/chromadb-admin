## 2024-05-18 - [Add React.memo() to `DetailPanel` and `DataGrid`]

**Learning:** `DataGrid` and `DetailPanel` use Jotai atoms. `DetailPanel` gets `selectedRecord` and `recordDetail` which triggers re-renders. `DataGrid` gets `selectedRecord` directly to apply selected class style. Selecting a row in `DataGrid` updates `selectedRecordAtom`, which causes `DataGrid` to re-render in its entirety, checking all 20 rows and updating classes.
**Action:** The table rows in `DataGrid` can be separated into a memoized `Row` component. By doing so, when `selectedRecordAtom` updates, we avoid re-rendering all rows. We can extract the table `tr` elements into a `<TableRow>` component wrapped with `React.memo()`. The parent `DataGrid` will still re-render because it reads `selectedRecordAtom`, but if we pass primitive props or memoized callbacks to `<TableRow>`, React can skip re-rendering rows that haven't changed their selection state.

## 2025-02-13 - [DataGrid Jotai Atom Re-renders]

**Learning:** Even if `DataGridRow` is memoized, if the parent `DataGrid` uses `useAtom(selectedRecordAtom)`, the entire `DataGrid` will still re-render when the selection changes, causing unchanged props to be evaluated for `DataGridRow`. This makes the O(N) re-render still occur at the parent level.
**Action:** Move `useAtomValue(selectedRecordAtom)` down into `DataGridRow` itself so each row can subscribe individually to the selection state and compute its own `isSelected`. Change the parent `DataGrid` to only use `useSetAtom(selectedRecordAtom)`. This turns an O(N) parent re-render into an O(1) row re-render (only the newly selected and unselected rows re-render). For edge cases where action handlers need atom values without subscribing (like `handleDeleteRecord`), use Jotai's `useStore().get(atom)`.

## 2025-02-14 - [Avoid Cascading Renders in Parent Layout Components]

**Learning:** `RecordPage` component used `useAtomValue(detailPanelOpenAtom)` solely to conditionally render the `<DetailPanel>` component. This meant that whenever the detail panel was toggled, `RecordPage` (the parent) re-rendered, which in turn cascaded re-renders down to heavy sibling components like `<DataGrid>`, `<DataToolbar>`, and `<StatusBar>`, regardless of whether their props had changed or not.
**Action:** Move the atom subscription for conditional rendering down into the child component itself. Change `DetailPanel` to subscribe to `detailPanelOpenAtom` and return `null` if false, and conditionally render it unconditionally in the parent layout (`RecordPage`). This isolates the re-render to only the component that actually cares about the state change, preventing expensive cascading updates.
