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

function mergeAbortSignals(
  ...signals: Array<AbortSignal | null | undefined>
): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal != null);

  if (activeSignals.length === 0) {
    return undefined;
  }
  if (activeSignals.length === 1) {
    return activeSignals[0];
  }

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(activeSignals);
  }
  if (typeof AbortController === 'undefined') {
    return activeSignals[0];
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
      return controller.signal;
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  return controller.signal;
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
  let controller: AbortController | undefined;

  const abort = () => {
    if (controller) {
      controller.abort();
      controller = undefined;
      aborted(true);
      isLoading(false);
    }
  };

  const execute = async (init?: RequestInit): Promise<T | null> => {
    const id = ++requestId;

    abort();
    error(null);
    isLoading(true);
    aborted(false);

    const currentController =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    controller = currentController;

    try {
      const signal = mergeAbortSignals(
        options.init?.signal,
        init?.signal,
        currentController?.signal
      );
      const response = await fetcher(toValue(input as MaybeAccessor<RequestInfo | URL>), {
        ...options.init,
        ...init,
        signal
      });

      if (id !== requestId) {
        return data();
      }

      status(response.status);

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const parsed = await parse(response);
      data(parsed);
      return parsed;
    } catch (err) {
      if (id !== requestId) {
        return data();
      }

      if (err instanceof DOMException && err.name === 'AbortError') {
        aborted(true);
        return data();
      }

      error(err);
      options.onError?.(err);
      return data();
    } finally {
      if (controller === currentController) {
        controller = undefined;
      }
      if (id === requestId) {
        isLoading(false);
      }
    }
  };

  if (options.immediate ?? true) {
    void execute();
  }

  tryOnDestroy(abort);

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
