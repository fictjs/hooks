# @fictjs/hooks

[![Node CI](https://github.com/fictjs/hooks/actions/workflows/nodejs.yml/badge.svg)](https://github.com/fictjs/hooks/actions/workflows/nodejs.yml)
[![npm](https://img.shields.io/npm/v/@fictjs/hooks.svg)](https://www.npmjs.com/package/@fictjs/hooks)
![license](https://img.shields.io/npm/l/@fictjs/hooks)

Official hooks package for Fict.

`@fictjs/hooks` provides official, production-ready hooks built for Fict signal/lifecycle semantics.

## Highlights

- 39 official hooks across lifecycle, event, timing, state, browser, storage, observer, async and clipboard
- SSR-safe browser hooks with injectable globals (`window`, `document`, `navigator`) for non-browser/test environments
- Root-only public entry (`@fictjs/hooks`) with ESM tree shaking support
- Strong type coverage and CI quality gates (`lint`, `typecheck`, `test:types`, `test`, `build`)

## Install

For application usage:

```bash
npm add @fictjs/hooks @fictjs/runtime
# or
yarn add @fictjs/hooks @fictjs/runtime
# or
pnpm add @fictjs/hooks @fictjs/runtime
```

## Requirements

- Node.js >= 18
- Peer dependency: `@fictjs/runtime@^0.12.0`

## Quick Start

```ts
import { useCounter, useMount } from '@fictjs/hooks';

export function CounterExample() {
  const { count, inc, dec, reset } = useCounter(0);

  useMount(() => {
    inc();
  });

  return { count, inc, dec, reset };
}
```

In plain TypeScript/JavaScript usage (without Fict compile transforms), read reactive values via accessors, for example `count()`.

## Import Policy

- Only import from `@fictjs/hooks`; deep imports are unsupported
- Tree shaking is supported through ESM exports and `"sideEffects": false`

## Runtime Semantics

- Hooks follow Fict top-level hook rules (`useX` in component/hook top-level scope)
- Effects/listeners/timers are auto-cleaned on root dispose
- Browser hooks are SSR-safe and provide unsupported fallbacks
- Browser globals can be injected with options like `window`, `document`, or `navigator` when needed

## Hook Docs

All hook docs live in [`docs/hooks`](docs/hooks).

- Lifecycle: [`useMount`](docs/hooks/useMount.md), [`useUnmount`](docs/hooks/useUnmount.md)
- Event: [`useEventListener`](docs/hooks/useEventListener.md), [`useClickOutside`](docs/hooks/useClickOutside.md), [`useHover`](docs/hooks/useHover.md), [`useFocusWithin`](docs/hooks/useFocusWithin.md), [`useKeyPress`](docs/hooks/useKeyPress.md)
- Timing: [`useDebounceFn`](docs/hooks/useDebounceFn.md), [`useThrottleFn`](docs/hooks/useThrottleFn.md), [`useTimeoutFn`](docs/hooks/useTimeoutFn.md), [`useIntervalFn`](docs/hooks/useIntervalFn.md), [`useRafFn`](docs/hooks/useRafFn.md)
- State: [`useToggle`](docs/hooks/useToggle.md), [`useCounter`](docs/hooks/useCounter.md), [`usePrevious`](docs/hooks/usePrevious.md), [`useVirtualList`](docs/hooks/useVirtualList.md)
- Browser: [`useScroll`](docs/hooks/useScroll.md), [`useWindowScroll`](docs/hooks/useWindowScroll.md), [`useWindowSize`](docs/hooks/useWindowSize.md), [`useTitle`](docs/hooks/useTitle.md), [`useFullscreen`](docs/hooks/useFullscreen.md), [`usePermission`](docs/hooks/usePermission.md), [`useGeolocation`](docs/hooks/useGeolocation.md), [`useIdle`](docs/hooks/useIdle.md), [`useSize`](docs/hooks/useSize.md), [`useWebSocket`](docs/hooks/useWebSocket.md), [`useMediaQuery`](docs/hooks/useMediaQuery.md), [`useDocumentVisibility`](docs/hooks/useDocumentVisibility.md), [`useNetwork`](docs/hooks/useNetwork.md)
- Storage: [`useStorage`](docs/hooks/useStorage.md), [`useLocalStorage`](docs/hooks/useLocalStorage.md), [`useSessionStorage`](docs/hooks/useSessionStorage.md)
- Observer: [`useIntersectionObserver`](docs/hooks/useIntersectionObserver.md), [`useResizeObserver`](docs/hooks/useResizeObserver.md), [`useMutationObserver`](docs/hooks/useMutationObserver.md)
- Async: [`useAsyncState`](docs/hooks/useAsyncState.md), [`useFetch`](docs/hooks/useFetch.md), [`useRequest`](docs/hooks/useRequest.md)
- Clipboard: [`useClipboard`](docs/hooks/useClipboard.md)

## Demo Website

Run interactive hook demos:

```bash
pnpm demo:dev
```

Build static demo site:

```bash
pnpm demo:build
```

## Quality Gates

Before publish, these checks must pass:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test:types`
4. `pnpm test`
5. `pnpm build`

`prepublishOnly` already enforces this pipeline.

## License

[MIT](./LICENSE)
