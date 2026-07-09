/* eslint-disable @typescript-eslint/no-unused-vars */

import { type UseRequestCacheEntry, type UseRequestReturn } from '@fictjs/hooks';
import {
  clearRequestCache,
  useAsyncState,
  useCounter,
  useDebounceFn,
  useFetch,
  useLocalStorage,
  useRequest,
  useStorage,
  useThrottleFn,
  useToggle,
  useVirtualList
} from '@fictjs/hooks';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const counter = useCounter(1, { min: 0, max: 10 });
type CounterValue = ReturnType<typeof counter.count>;
const _counterValue: Assert<Equal<CounterValue, number>> = true;

const toggle = useToggle(false);
type ToggleValue = ReturnType<typeof toggle.value>;
const _toggleValue: Assert<Equal<ToggleValue, boolean>> = true;

const debounced = useDebounceFn((value: string, count: number) => `${value}:${count}`, 100);
debounced.run('value', 1);
// @ts-expect-error preserves the wrapped callback's argument types
debounced.run(1, 'value');

const throttled = useThrottleFn((value: number) => value * 2, 100);
throttled.run(1);
// @ts-expect-error preserves the wrapped callback's argument types
throttled.run('1');

const storage = useStorage('demo-storage', { count: 1 });
type StorageValue = ReturnType<typeof storage.value>;
const _storageValue: Assert<Equal<StorageValue, { count: number }>> = true;
storage.value({ count: 2 });
storage.value((prev) => ({ count: prev.count + 1 }));

const localStorageState = useLocalStorage('theme', 'light');
type LocalStorageValue = ReturnType<typeof localStorageState.value>;
const _localStorageValue: Assert<Equal<LocalStorageValue, string>> = true;
localStorageState.value('dark');

const request = useRequest(async (name: string, age: number) => ({ name, age }), {
  manual: true
});
type RequestType = typeof request;
const _requestShape: UseRequestReturn<{ name: string; age: number }, [string, number]> = request;
type RequestData = ReturnType<RequestType['data']>;
const _requestData: Assert<Equal<RequestData, { name: string; age: number } | undefined>> = true;

const requestCacheProvider = new Map<string, UseRequestCacheEntry<{ name: string }>>();
useRequest(async (name: string) => ({ name }), {
  manual: true,
  cacheKey: 'typed-cache-provider',
  cacheProvider: requestCacheProvider
});
clearRequestCache('typed-cache-provider');

useRequest(async (name: string) => name, {
  defaultParams: ['fict']
});
useRequest(async () => 'ready');
useRequest(async (name?: string) => name ?? 'ready');
// @ts-expect-error required service parameters need manual mode or defaultParams
useRequest(async (name: string) => name);
// @ts-expect-error explicitly automatic requests with required parameters need defaultParams
useRequest(async (name: string) => name, { manual: false });
// @ts-expect-error implicit automatic requests with required parameters need defaultParams
useRequest(async (name: string) => name, {});

const fetched = useFetch<{ ok: boolean }>('https://example.com', { immediate: false });
type FetchData = ReturnType<typeof fetched.data>;
const _fetchData: Assert<Equal<FetchData, { ok: boolean } | null>> = true;

const asyncState = useAsyncState(async (count: number) => count * 2, 0);
type AsyncStateValue = ReturnType<typeof asyncState.state>;
const _asyncStateValue: Assert<Equal<AsyncStateValue, number>> = true;

useAsyncState(async (count: number) => count * 2, 0, {
  immediate: true,
  immediateArgs: [2]
});
useAsyncState(async () => 1, 0, { immediate: true });
// @ts-expect-error immediate execution of a required-argument executor needs immediateArgs
useAsyncState(async (count: number) => count * 2, 0, { immediate: true });
useAsyncState(async (count: number) => count * 2, 0, {
  immediate: true,
  // @ts-expect-error immediateArgs preserves executor argument types
  immediateArgs: ['2']
});

const virtual = useVirtualList(['a', 'b'], { itemHeight: 20, containerHeight: 100 });
type VirtualTotalHeight = ReturnType<typeof virtual.totalHeight>;
const _virtualTotalHeight: Assert<Equal<VirtualTotalHeight, number>> = true;

type StorageReturnCompatibility = ReturnType<typeof useStorage<number>>;
const _storageReturnCompatibility: StorageReturnCompatibility = useStorage('num', 1);
