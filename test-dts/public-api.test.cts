/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */

import api = require('@fictjs/hooks');
import type {
  GeolocationCoordsState,
  KeyEventName,
  KeyFilter,
  MountCallback,
  PermissionInput,
  ScrollPosition,
  UnmountCallback,
  UseAsyncStateOptions,
  UseAsyncStateReturn,
  UseClickOutsideControls,
  UseClickOutsideOptions,
  UseClipboardOptions,
  UseClipboardReturn,
  UseCounterOptions,
  UseCounterReturn,
  UseDebounceFnOptions,
  UseDocumentVisibilityOptions,
  UseDocumentVisibilityReturn,
  UseEventListenerControls,
  UseFetchOptions,
  UseFetchReturn,
  UseFocusWithinOptions,
  UseFocusWithinReturn,
  UseFullscreenOptions,
  UseFullscreenReturn,
  UseGeolocationOptions,
  UseGeolocationReturn,
  UseHoverOptions,
  UseHoverReturn,
  UseIdleOptions,
  UseIdleReturn,
  UseIntersectionObserverOptions,
  UseIntersectionObserverReturn,
  UseIntervalFnControls,
  UseKeyPressOptions,
  UseMediaQueryOptions,
  UseMediaQueryReturn,
  UseMutationObserverOptions,
  UseMutationObserverReturn,
  UseNetworkOptions,
  UseNetworkReturn,
  UsePermissionOptions,
  UsePermissionReturn,
  UseRafFnOptions,
  UseRafFnReturn,
  UseRequestCacheEntry,
  UseRequestOptions,
  UseRequestReturn,
  UseResizeObserverOptions,
  UseResizeObserverReturn,
  UseScrollOptions,
  UseScrollReturn,
  UseSizeOptions,
  UseSizeReturn,
  UseStorageHookOptions,
  UseThrottleFnOptions,
  UseTimeoutFnControls,
  UseTitleOptions,
  UseTitleReturn,
  UseToggleReturn,
  UseVirtualListOptions,
  UseVirtualListReturn,
  UseWebSocketOptions,
  UseWebSocketReconnectOptions,
  UseWebSocketReturn,
  UseWindowScrollOptions,
  UseWindowSizeOptions,
  UseWindowSizeReturn,
  VirtualItem,
  WebSocketStatus
} from '@fictjs/hooks';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type HookName =
  | 'useAsyncState'
  | 'useClickOutside'
  | 'useClipboard'
  | 'useCounter'
  | 'useDebounceFn'
  | 'useDocumentVisibility'
  | 'useEventListener'
  | 'useFetch'
  | 'useFocusWithin'
  | 'useFullscreen'
  | 'useGeolocation'
  | 'useHover'
  | 'useIdle'
  | 'useIntersectionObserver'
  | 'useIntervalFn'
  | 'useKeyPress'
  | 'useLocalStorage'
  | 'useMediaQuery'
  | 'useMount'
  | 'useMutationObserver'
  | 'useNetwork'
  | 'usePermission'
  | 'usePrevious'
  | 'useRafFn'
  | 'useRequest'
  | 'useResizeObserver'
  | 'useScroll'
  | 'useSessionStorage'
  | 'useSize'
  | 'useStorage'
  | 'useThrottleFn'
  | 'useTimeoutFn'
  | 'useTitle'
  | 'useToggle'
  | 'useUnmount'
  | 'useVirtualList'
  | 'useWebSocket'
  | 'useWindowScroll'
  | 'useWindowSize';

type _RootValueExports = Assert<Equal<keyof typeof api, HookName | 'clearRequestCache'>>;
type _AllHookExports = Assert<Equal<Extract<keyof typeof api, `use${string}`>, HookName>>;

api.useScroll({ target: null }).refresh();
api.useSize(null).refresh();
api.useWindowScroll({ window: null }).refresh();

type _RootTypeExports = [
  GeolocationCoordsState,
  KeyEventName,
  KeyFilter,
  MountCallback,
  PermissionInput,
  ScrollPosition,
  UnmountCallback,
  UseAsyncStateOptions,
  UseAsyncStateReturn<unknown, []>,
  UseClickOutsideControls,
  UseClickOutsideOptions,
  UseClipboardOptions,
  UseClipboardReturn,
  UseCounterOptions,
  UseCounterReturn,
  UseDebounceFnOptions,
  UseDocumentVisibilityOptions,
  UseDocumentVisibilityReturn,
  UseEventListenerControls,
  UseFetchOptions<unknown>,
  UseFetchReturn<unknown>,
  UseFocusWithinOptions,
  UseFocusWithinReturn,
  UseFullscreenOptions,
  UseFullscreenReturn,
  UseGeolocationOptions,
  UseGeolocationReturn,
  UseHoverOptions,
  UseHoverReturn,
  UseIdleOptions,
  UseIdleReturn,
  UseIntersectionObserverOptions,
  UseIntersectionObserverReturn,
  UseIntervalFnControls,
  UseKeyPressOptions,
  UseMediaQueryOptions,
  UseMediaQueryReturn,
  UseMutationObserverOptions,
  UseMutationObserverReturn,
  UseNetworkOptions,
  UseNetworkReturn,
  UsePermissionOptions,
  UsePermissionReturn,
  UseRafFnOptions,
  UseRafFnReturn,
  UseRequestCacheEntry<unknown>,
  UseRequestOptions<unknown, []>,
  UseRequestReturn<unknown, []>,
  UseResizeObserverOptions,
  UseResizeObserverReturn,
  UseScrollOptions,
  UseScrollReturn,
  UseSizeOptions,
  UseSizeReturn,
  UseStorageHookOptions<unknown>,
  UseThrottleFnOptions,
  UseTimeoutFnControls,
  UseTitleOptions,
  UseTitleReturn,
  UseToggleReturn,
  UseVirtualListOptions,
  UseVirtualListReturn<unknown>,
  UseWebSocketOptions,
  UseWebSocketReconnectOptions,
  UseWebSocketReturn,
  UseWindowScrollOptions,
  UseWindowSizeOptions,
  UseWindowSizeReturn,
  VirtualItem<unknown>,
  WebSocketStatus
];
