import { createSignal } from '@fictjs/runtime/advanced';

export interface UseAsyncStateOptions {
  immediate?: boolean;
  resetOnExecute?: boolean;
  onError?: (error: unknown) => void;
}

export interface UseAsyncStateReturn<T, Args extends unknown[]> {
  state: () => T;
  isLoading: () => boolean;
  error: () => unknown;
  execute: (...args: Args) => Promise<T>;
}

/**
 * Lightweight async state manager with race protection.
 *
 * @fictReturn { state: 'signal', isLoading: 'signal', error: 'signal' }
 */
export function useAsyncState<T, Args extends unknown[] = []>(
  executor: (...args: Args) => Promise<T>,
  initialState: T,
  options: UseAsyncStateOptions = {}
): UseAsyncStateReturn<T, Args> {
  const state = createSignal(initialState);
  const isLoading = createSignal(false);
  const error = createSignal<unknown>(null);

  let callId = 0;

  const execute = async (...args: Args): Promise<T> => {
    const id = ++callId;

    if (options.resetOnExecute) {
      state(initialState);
    }

    isLoading(true);
    error(null);

    try {
      const result = await executor(...args);
      if (id === callId) {
        state(result);
      }
      return result;
    } catch (err) {
      if (id === callId) {
        error(err);
      }
      options.onError?.(err);
      throw err;
    } finally {
      if (id === callId) {
        isLoading(false);
      }
    }
  };

  if (options.immediate) {
    void execute().catch(() => {
      // ignore by default; error signal + onError handle it
    });
  }

  return {
    state,
    isLoading,
    error,
    execute
  };
}
