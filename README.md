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
- Published Fict package metadata (`dist/index.fict.meta.json`) for cross-package hook return reactivity
- Strong type and coverage gates (`lint`, `typecheck`, `test:types`, `test:coverage`, `build`, `verify:metadata`, `test:attw`)

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

- Runtime consumers: Node.js >= 18
- Repository development/build/test: Node.js `^22.18.0 || >=24.11.0` (the supported range of the build toolchain)
- Release publishing: Node.js 24.11 or newer
- Peer dependency: `@fictjs/runtime@^0.26.0`

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

## Fict Metadata

`pnpm build` emits:

- `dist/index.fict.meta.json`
- ESM/CJS runtime files
- `.d.ts` and `.d.cts` type declarations

`package.json#fict.metadata` points at the generated metadata file so Fict 0.26.0 consumers can recover hook return reactivity from the published npm package.

Run `pnpm verify:metadata` after `pnpm build` to verify the generated metadata and the npm tarball contents.

## Runtime Semantics

- Hooks follow Fict top-level hook rules (`useX` in component/hook top-level scope)
- Effects/listeners/timers are auto-cleaned on root dispose
- Browser hooks are SSR-safe and provide unsupported fallbacks
- Browser globals can be injected with options like `window`, `document`, or `navigator` when needed

## Hook Docs

All hook docs are versioned with each release under [`docs/hooks`](https://github.com/fictjs/hooks/tree/v0.29.0/docs/hooks).

- Lifecycle: [`useMount`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useMount.md), [`useUnmount`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useUnmount.md)
- Event: [`useEventListener`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useEventListener.md), [`useClickOutside`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useClickOutside.md), [`useHover`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useHover.md), [`useFocusWithin`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useFocusWithin.md), [`useKeyPress`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useKeyPress.md)
- Timing: [`useDebounceFn`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useDebounceFn.md), [`useThrottleFn`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useThrottleFn.md), [`useTimeoutFn`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useTimeoutFn.md), [`useIntervalFn`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useIntervalFn.md), [`useRafFn`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useRafFn.md)
- State: [`useToggle`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useToggle.md), [`useCounter`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useCounter.md), [`usePrevious`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/usePrevious.md), [`useVirtualList`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useVirtualList.md)
- Browser: [`useScroll`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useScroll.md), [`useWindowScroll`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useWindowScroll.md), [`useWindowSize`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useWindowSize.md), [`useTitle`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useTitle.md), [`useFullscreen`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useFullscreen.md), [`usePermission`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/usePermission.md), [`useGeolocation`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useGeolocation.md), [`useIdle`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useIdle.md), [`useSize`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useSize.md), [`useWebSocket`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useWebSocket.md), [`useMediaQuery`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useMediaQuery.md), [`useDocumentVisibility`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useDocumentVisibility.md), [`useNetwork`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useNetwork.md)
- Storage: [`useStorage`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useStorage.md), [`useLocalStorage`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useLocalStorage.md), [`useSessionStorage`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useSessionStorage.md)
- Observer: [`useIntersectionObserver`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useIntersectionObserver.md), [`useResizeObserver`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useResizeObserver.md), [`useMutationObserver`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useMutationObserver.md)
- Async: [`useAsyncState`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useAsyncState.md), [`useFetch`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useFetch.md), [`useRequest`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useRequest.md)
- Clipboard: [`useClipboard`](https://github.com/fictjs/hooks/blob/v0.29.0/docs/hooks/useClipboard.md)

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

1. `pnpm audit:dev`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:types`
5. `pnpm test:types:ts53`
6. `pnpm test:coverage`
7. `pnpm build`
8. `pnpm verify:metadata`
9. `pnpm test:attw`

`prepublishOnly` already enforces this pipeline.

## License

[MIT](./LICENSE)
