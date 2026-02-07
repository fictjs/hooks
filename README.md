# @fictjs/hooks

Official hooks package for Fict.

## Hook docs

- Lifecycle
  - `useMount` -> `docs/hooks/useMount.md`
  - `useUnmount` -> `docs/hooks/useUnmount.md`
- Event
  - `useEventListener` -> `docs/hooks/useEventListener.md`
  - `useClickOutside` -> `docs/hooks/useClickOutside.md`
  - `useHover` -> `docs/hooks/useHover.md`
  - `useFocusWithin` -> `docs/hooks/useFocusWithin.md`
  - `useKeyPress` -> `docs/hooks/useKeyPress.md`
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
  - `useScroll` -> `docs/hooks/useScroll.md`
  - `useWindowScroll` -> `docs/hooks/useWindowScroll.md`
  - `useWindowSize` -> `docs/hooks/useWindowSize.md`
  - `useTitle` -> `docs/hooks/useTitle.md`
  - `useFullscreen` -> `docs/hooks/useFullscreen.md`
  - `usePermission` -> `docs/hooks/usePermission.md`
  - `useGeolocation` -> `docs/hooks/useGeolocation.md`
  - `useIdle` -> `docs/hooks/useIdle.md`
  - `useSize` -> `docs/hooks/useSize.md`
  - `useWebSocket` -> `docs/hooks/useWebSocket.md`
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
pnpm install
```

## Demo Website

Run interactive hook demos:

```bash
pnpm demo:dev
```

Build static demo site:

```bash
pnpm demo:build
```

## Scripts

- `pnpm dev`: watch mode build with tsup
- `pnpm build`: build ESM + CJS + d.ts to `dist`
- `pnpm demo:dev`: run Vite demo website (`playground/`)
- `pnpm demo:build`: build Vite demo website
- `pnpm demo:preview`: preview built demo website
- `pnpm typecheck`: TypeScript type checking
- `pnpm test:types`: API type assertion tests
- `pnpm lint`: ESLint check
- `pnpm test`: run unit tests with Vitest
- `pnpm test:coverage`: run tests with coverage threshold checks
- `pnpm format`: format files with Prettier

## Publish safety

`prepublishOnly` runs:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:types`
4. `pnpm test`
5. `pnpm build`

## Entry

Package entry is `src/index.ts`.
