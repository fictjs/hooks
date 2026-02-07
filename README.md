# @fictjs/hooks

Official hooks package for Fict.

## Hook docs

- Lifecycle
  - `useMount` -> `docs/hooks/useMount.md`
  - `useUnmount` -> `docs/hooks/useUnmount.md`
- Event
  - `useEventListener` -> `docs/hooks/useEventListener.md`
  - `useClickOutside` -> `docs/hooks/useClickOutside.md`
- Timing
  - `useDebounceFn` -> `docs/hooks/useDebounceFn.md`
  - `useThrottleFn` -> `docs/hooks/useThrottleFn.md`
  - `useTimeoutFn` -> `docs/hooks/useTimeoutFn.md`
  - `useIntervalFn` -> `docs/hooks/useIntervalFn.md`
  - `useRafFn` -> `docs/hooks/useRafFn.md`
- State
  - `useToggle` -> `docs/hooks/useToggle.md`
  - `useCounter` -> `docs/hooks/useCounter.md`
  - `usePrevious` -> `docs/hooks/usePrevious.md`
  - `useVirtualList` -> `docs/hooks/useVirtualList.md`
- Browser
  - `useWindowSize` -> `docs/hooks/useWindowSize.md`
  - `useMediaQuery` -> `docs/hooks/useMediaQuery.md`
  - `useDocumentVisibility` -> `docs/hooks/useDocumentVisibility.md`
  - `useNetwork` -> `docs/hooks/useNetwork.md`
- Storage
  - `useStorage` -> `docs/hooks/useStorage.md`
  - `useLocalStorage` -> `docs/hooks/useLocalStorage.md`
  - `useSessionStorage` -> `docs/hooks/useSessionStorage.md`
- Observer
  - `useIntersectionObserver` -> `docs/hooks/useIntersectionObserver.md`
  - `useResizeObserver` -> `docs/hooks/useResizeObserver.md`
  - `useMutationObserver` -> `docs/hooks/useMutationObserver.md`
- Async
  - `useAsyncState` -> `docs/hooks/useAsyncState.md`
  - `useFetch` -> `docs/hooks/useFetch.md`
  - `useRequest` -> `docs/hooks/useRequest.md`
- Clipboard
  - `useClipboard` -> `docs/hooks/useClipboard.md`

## Requirements

- Node.js >= 18

## Setup

```bash
npm install
```

## Scripts

- `npm run dev`: watch mode build with tsup
- `npm run build`: build ESM + CJS + d.ts to `dist`
- `npm run typecheck`: TypeScript type checking
- `npm run lint`: ESLint check
- `npm run test`: run unit tests with Vitest
- `npm run format`: format files with Prettier

## Publish safety

`prepublishOnly` runs:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`

## Entry

Package entry is `src/index.ts`.
