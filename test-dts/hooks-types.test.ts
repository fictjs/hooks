/* eslint-disable @typescript-eslint/no-unused-vars */

import { type UseRequestReturn } from '../src/index';
import {
  useAsyncState,
  useCounter,
  useFetch,
  useLocalStorage,
  useRequest,
  useStorage,
  useToggle,
  useVirtualList
} from '../src/index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const counter = useCounter(1, { min: 0, max: 10 });
type CounterValue = ReturnType<typeof counter.count>;
const _counterValue: Assert<Equal<CounterValue, number>> = true;

const toggle = useToggle(false);
type ToggleValue = ReturnType<typeof toggle.value>;
const _toggleValue: Assert<Equal<ToggleValue, boolean>> = true;

const storage = useStorage('demo-storage', { count: 1 });
type StorageValue = ReturnType<typeof storage.value>;
const _storageValue: Assert<Equal<StorageValue, { count: number }>> = true;

const localStorageState = useLocalStorage('theme', 'light');
type LocalStorageValue = ReturnType<typeof localStorageState.value>;
const _localStorageValue: Assert<Equal<LocalStorageValue, string>> = true;

const request = useRequest(async (name: string, age: number) => ({ name, age }), {
  manual: true
});
type RequestType = typeof request;
const _requestShape: UseRequestReturn<{ name: string; age: number }, [string, number]> = request;
type RequestData = ReturnType<RequestType['data']>;
const _requestData: Assert<Equal<RequestData, { name: string; age: number } | undefined>> = true;

const fetched = useFetch<{ ok: boolean }>('https://example.com', { immediate: false });
type FetchData = ReturnType<typeof fetched.data>;
const _fetchData: Assert<Equal<FetchData, { ok: boolean } | null>> = true;

const asyncState = useAsyncState(async (count: number) => count * 2, 0);
type AsyncStateValue = ReturnType<typeof asyncState.state>;
const _asyncStateValue: Assert<Equal<AsyncStateValue, number>> = true;

const virtual = useVirtualList(['a', 'b'], { itemHeight: 20, containerHeight: 100 });
type VirtualTotalHeight = ReturnType<typeof virtual.totalHeight>;
const _virtualTotalHeight: Assert<Equal<VirtualTotalHeight, number>> = true;

type StorageReturnCompatibility = ReturnType<typeof useStorage<number>>;
const _storageReturnCompatibility: StorageReturnCompatibility = useStorage('num', 1);
