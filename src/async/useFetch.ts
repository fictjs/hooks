import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface UseFetchOptions<T> {
  immediate?: boolean;
  initialData?: T | null;
  fetch?: typeof fetch;
  parse?: (response: Response) => Promise<T>;
  onError?: (error: unknown) => void;
  init?: RequestInit;
}

export interface UseFetchReturn<T> {
  data: () => T | null;
  error: () => unknown;
  isLoading: () => boolean;
  status: () => number | null;
  aborted: () => boolean;
  execute: (init?: RequestInit) => Promise<T | null>;
  abort: () => void;
}

async function defaultParse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

interface MergedAbortSignal {
  signal: AbortSignal | undefined;
  cleanup: () => void;
}

const FETCH_ABORTED = Symbol('FETCH_ABORTED');

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function mergeAbortSignals(...signals: Array<AbortSignal | null | undefined>): MergedAbortSignal {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal != null);
  const empty = {
    signal: undefined,
    cleanup() {}
  };

  if (activeSignals.length === 0) {
    return empty;
  }
  if (activeSignals.length === 1) {
    return {
      signal: activeSignals[0],
      cleanup() {}
    };
  }

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return {
      signal: AbortSignal.any(activeSignals),
      cleanup() {}
    };
  }
  if (typeof AbortController === 'undefined') {
    return {
      signal: activeSignals[0],
      cleanup() {}
    };
  }

  const controller = new AbortController();
  const registrations: AbortSignal[] = [];
  let cleanupActive = true;
  const cleanup = () => {
    if (!cleanupActive) {
      return;
    }
    cleanupActive = false;
    const currentRegistrations = registrations.splice(0);
    for (const signal of currentRegistrations) {
      try {
        signal.removeEventListener('abort', abort);
      } catch {
        // Listener teardown is best-effort; every remaining registration must still be tried.
      }
    }
  };
  const abort = () => {
    cleanup();
    const abortedSignal = activeSignals.find((signal) => signal.aborted);
    controller.abort(abortedSignal?.reason);
  };

  try {
    for (const signal of activeSignals) {
      if (signal.aborted) {
        abort();
        return {
          signal: controller.signal,
          cleanup
        };
      }
      registrations.push(signal);
      signal.addEventListener('abort', abort, { once: true });
    }
  } catch (error) {
    cleanup();
    throw error;
  }

  return {
    signal: controller.signal,
    cleanup
  };
}

function copyRequestInitProperties(
  target: RequestInit,
  source: RequestInit | null | undefined,
  canContinue: () => boolean
): boolean {
  if (source == null) {
    return canContinue();
  }

  const keys = Reflect.ownKeys(source);
  if (!canContinue()) {
    return false;
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!canContinue()) {
      return false;
    }
    if (!descriptor?.enumerable) {
      continue;
    }
    const value = Reflect.get(source, key);
    if (!canContinue()) {
      return false;
    }
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  }
  return true;
}

/**
 * Fetch helper with loading/error/abort state.
 *
 * @fictReturn { data: 'signal', error: 'signal', isLoading: 'signal', status: 'signal', aborted: 'signal' }
 */
export function useFetch<T = unknown>(
  input: RequestInfo | URL | MaybeAccessor<RequestInfo | URL>,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const data = createSignal<T | null>(options.initialData ?? null);
  const error = createSignal<unknown>(null);
  const isLoading = createSignal(false);
  const status = createSignal<number | null>(null);
  const aborted = createSignal(false);

  const fetcher = options.fetch ?? fetch;
  const parse = options.parse ?? defaultParse<T>;

  let operationGeneration = 0;
  let activeRequestOperation: number | null = null;
  let controller: AbortController | undefined;
  let cancelActiveRequest: (() => void) | undefined;
  let disposed = false;
  const ownsOperation = (operation: number) => !disposed && operation === operationGeneration;
  const ownsRequest = (operation: number) =>
    ownsOperation(operation) && activeRequestOperation === operation;

  const abortActiveRequest = (operation: number, terminal = false) => {
    if (activeRequestOperation == null) {
      if (terminal && isLoading()) {
        isLoading(false);
      }
      return;
    }

    activeRequestOperation = null;
    const currentController = controller;
    const currentCancelRequest = cancelActiveRequest;
    controller = undefined;
    cancelActiveRequest = undefined;
    aborted(true);
    if (terminal || ownsOperation(operation)) {
      isLoading(false);
    }
    currentCancelRequest?.();
    currentController?.abort();
  };

  const abort = () => {
    if (activeRequestOperation == null) {
      return;
    }
    const operation = ++operationGeneration;
    abortActiveRequest(operation);
  };

  const execute = async (init?: RequestInit): Promise<T | null> => {
    if (disposed) {
      return data();
    }

    const operation = ++operationGeneration;
    abortActiveRequest(operation);
    if (!ownsOperation(operation)) {
      return data();
    }
    activeRequestOperation = operation;
    error(null);
    if (!ownsRequest(operation)) {
      return data();
    }
    isLoading(true);
    if (!ownsRequest(operation)) {
      return data();
    }
    aborted(false);
    if (!ownsRequest(operation)) {
      return data();
    }

    const currentController =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    if (!ownsRequest(operation)) {
      currentController?.abort();
      return data();
    }
    controller = currentController;
    let cleanupSignal = () => {};
    let cleanupAbortListener = () => {};
    let requestSignal: AbortSignal | undefined;
    let resolveCanceledRequest = () => {};
    const canceledRequest = new Promise<typeof FETCH_ABORTED>((resolve) => {
      resolveCanceledRequest = () => resolve(FETCH_ABORTED);
    });
    cancelActiveRequest = resolveCanceledRequest;

    try {
      const optionInit = options.init;
      if (!ownsRequest(operation)) {
        return data();
      }
      const optionSignal = optionInit?.signal;
      if (!ownsRequest(operation)) {
        return data();
      }
      const executeSignal = init?.signal;
      if (!ownsRequest(operation)) {
        return data();
      }
      const controllerSignal = currentController?.signal;
      if (!ownsRequest(operation)) {
        return data();
      }
      const mergedSignal = mergeAbortSignals(optionSignal, executeSignal, controllerSignal);
      cleanupSignal = mergedSignal.cleanup;
      requestSignal = mergedSignal.signal;
      if (!ownsRequest(operation)) {
        return data();
      }
      const abortPromise = requestSignal
        ? new Promise<typeof FETCH_ABORTED>((resolve) => {
            const handleAbort = () => {
              if (ownsRequest(operation)) {
                aborted(true);
                if (ownsRequest(operation)) {
                  isLoading(false);
                }
              }
              resolve(FETCH_ABORTED);
            };

            const signalAborted = requestSignal!.aborted;
            if (!ownsRequest(operation)) {
              resolve(FETCH_ABORTED);
              return;
            }
            if (signalAborted) {
              handleAbort();
              return;
            }

            requestSignal!.addEventListener('abort', handleAbort, { once: true });
            cleanupAbortListener = () => {
              requestSignal!.removeEventListener('abort', handleAbort);
              cleanupAbortListener = () => {};
            };
          })
        : undefined;
      const raceAbort = <Value>(promise: Promise<Value>) =>
        Promise.race<Value | typeof FETCH_ABORTED>([
          promise,
          canceledRequest,
          ...(abortPromise ? [abortPromise] : [])
        ]);

      const signalAbortedBeforeInput = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation) || signalAbortedBeforeInput) {
        return data();
      }

      const resolvedInput = toValue(input as MaybeAccessor<RequestInfo | URL>);
      if (!ownsRequest(operation)) {
        return data();
      }
      const signalAbortedBeforeFetch = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation) || signalAbortedBeforeFetch) {
        return data();
      }

      const requestInit: RequestInit = {};
      const canBuildRequest = () => ownsRequest(operation);
      if (
        !copyRequestInitProperties(requestInit, optionInit, canBuildRequest) ||
        !copyRequestInitProperties(requestInit, init, canBuildRequest)
      ) {
        return data();
      }
      Object.defineProperty(requestInit, 'signal', {
        configurable: true,
        enumerable: true,
        value: requestSignal,
        writable: true
      });
      const signalAbortedAfterInit = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation) || signalAbortedAfterInit) {
        return data();
      }

      const response = await raceAbort(fetcher(resolvedInput, requestInit));

      if (response === FETCH_ABORTED) {
        return data();
      }

      if (!ownsRequest(operation)) {
        return data();
      }

      const signalAbortedAfterFetch = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation)) {
        return data();
      }
      if (signalAbortedAfterFetch) {
        aborted(true);
        return data();
      }

      const responseStatus = response.status;
      if (!ownsRequest(operation)) {
        return data();
      }
      status(responseStatus);
      if (!ownsRequest(operation)) {
        return data();
      }

      const responseOk = response.ok;
      if (!ownsRequest(operation)) {
        return data();
      }
      if (!responseOk) {
        throw new Error(`Fetch failed with status ${responseStatus}`);
      }

      const parsed = await raceAbort(parse(response));
      if (parsed === FETCH_ABORTED) {
        return data();
      }
      if (!ownsRequest(operation)) {
        return data();
      }
      const signalAbortedAfterParse = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation)) {
        return data();
      }
      if (signalAbortedAfterParse) {
        aborted(true);
        return data();
      }
      data(parsed);
      return parsed;
    } catch (err) {
      if (!ownsRequest(operation)) {
        return data();
      }

      const signalAborted = requestSignal?.aborted ?? false;
      if (!ownsRequest(operation)) {
        return data();
      }
      const abortError = isAbortError(err);
      if (!ownsRequest(operation)) {
        return data();
      }
      if (signalAborted || abortError) {
        aborted(true);
        return data();
      }

      error(err);
      if (!ownsRequest(operation)) {
        return data();
      }

      const onError = options.onError;
      if (!ownsRequest(operation)) {
        return data();
      }

      onError?.(err);
      return data();
    } finally {
      cleanupAbortListener();
      cleanupSignal();
      if (controller === currentController) {
        controller = undefined;
      }
      if (cancelActiveRequest === resolveCanceledRequest) {
        cancelActiveRequest = undefined;
      }
      if (activeRequestOperation === operation) {
        activeRequestOperation = null;
      }
      if (ownsOperation(operation)) {
        isLoading(false);
      }
    }
  };

  if (options.immediate ?? true) {
    void execute().catch(() => {
      // Immediate execution has no caller to receive lifecycle callback failures.
    });
  }

  tryOnDestroy(() => {
    const operation = ++operationGeneration;
    disposed = true;
    abortActiveRequest(operation, true);
  });

  return {
    data,
    error,
    isLoading,
    status,
    aborted,
    execute,
    abort
  };
}
