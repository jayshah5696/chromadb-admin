## 2024-05-20 - [Synchronous localStorage.setItem on scroll]
**Learning:** Found a critical anti-pattern where `localStorage.setItem` was being called synchronously inside an `onScroll` handler in the collection sidebar. This forces synchronous JSON serialization and disk I/O on the main thread during high-frequency events, leading to severe scroll jank, especially when the sidebar has many collections.
**Action:** Always debounce state-persistence operations (like `localStorage` writes) that are tied to high-frequency events like scrolling or typing using tools like `useDebouncedCallback`.
