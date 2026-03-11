## 2024-03-11 - Debounce expensive localStorage writes on scroll events
**Learning:** Writing to `localStorage` synchronously with `JSON.stringify` on extremely frequent events like `onScroll` will severely degrade FPS as it blocks the main thread.
**Action:** When saving scroll position in React, pass `e.currentTarget.scrollTop` (extract it synchronously first) to a function debounced with `useDebouncedCallback` to only write the state when scrolling completes/pauses.
