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
  let cleanup = () => {};
  const abort = () => {
    cleanup();
    const abortedSignal = activeSignals.find((signal) => signal.aborted);
    controller.abort(abortedSignal?.reason);
  };

  cleanup = () => {
    for (const signal of activeSignals) {
      signal.removeEventListener('abort', abort);
    }
    cleanup = () => {};
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      abort();
      return {
        signal: controller.signal,
        cleanup
      };
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup
  };
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

  let requestId = 0;
  let activeRequestId: number | null = null;
  let controller: AbortController | undefined;
  let cancelActiveRequest: (() => void) | undefined;
  let disposed = false;

  const abort = () => {
    if (activeRequestId == null) {
      return;
    }

    requestId += 1;
    activeRequestId = null;
    const currentController = controller;
    const currentCancelRequest = cancelActiveRequest;
    controller = undefined;
    cancelActiveRequest = undefined;
    aborted(true);
    isLoading(false);
    currentCancelRequest?.();
    currentController?.abort();
  };

  const execute = async (init?: RequestInit): Promise<T | null> => {
    if (disposed) {
      return data();
    }

    abort();
    const id = ++requestId;
    activeRequestId = id;
    error(null);
    isLoading(true);
    aborted(false);

    const currentController =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
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
      const mergedSignal = mergeAbortSignals(
        options.init?.signal,
        init?.signal,
        currentController?.signal
      );
      cleanupSignal = mergedSignal.cleanup;
      requestSignal = mergedSignal.signal;
      const abortPromise = requestSignal
        ? new Promise<typeof FETCH_ABORTED>((resolve) => {
            const handleAbort = () => {
              if (id === requestId) {
                aborted(true);
                isLoading(false);
              }
              resolve(FETCH_ABORTED);
            };

            if (requestSignal!.aborted) {
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

      if (disposed || id !== requestId || requestSignal?.aborted) {
        return data();
      }

      const resolvedInput = toValue(input as MaybeAccessor<RequestInfo | URL>);
      if (disposed || id !== requestId || requestSignal?.aborted) {
        return data();
      }

      const response = await raceAbort(
        fetcher(resolvedInput, {
          ...options.init,
          ...init,
          signal: mergedSignal.signal
        })
      );

      if (response === FETCH_ABORTED) {
        return data();
      }

      if (id !== requestId) {
        return data();
      }

      if (mergedSignal.signal?.aborted) {
        aborted(true);
        return data();
      }

      status(response.status);

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const parsed = await raceAbort(parse(response));
      if (parsed === FETCH_ABORTED) {
        return data();
      }
      if (id !== requestId) {
        return data();
      }
      if (mergedSignal.signal?.aborted) {
        aborted(true);
        return data();
      }
      data(parsed);
      return parsed;
    } catch (err) {
      if (id !== requestId) {
        return data();
      }

      if (requestSignal?.aborted || isAbortError(err)) {
        aborted(true);
        return data();
      }

      error(err);
      if (disposed || id !== requestId) {
        return data();
      }

      options.onError?.(err);
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
      if (activeRequestId === id) {
        activeRequestId = null;
      }
      if (id === requestId) {
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
    disposed = true;
    abort();
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
