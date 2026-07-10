import { createSignal } from '@fictjs/runtime/advanced';
import { tryOnDestroy } from '../internal/lifecycle';
import type { NoInferCompat } from '../internal/types';

interface UseAsyncStateBaseOptions {
  resetOnExecute?: boolean;
  onError?: (error: unknown) => void;
}

type UseAsyncStateImmediateOptions<Args extends unknown[]> = [] extends Args
  ? {
      immediate?: boolean;
      immediateArgs?: Args;
    }
  :
      | {
          immediate?: false;
          immediateArgs?: never;
        }
      | {
          immediate: boolean;
          immediateArgs: Args;
        };

export type UseAsyncStateOptions<Args extends unknown[] = []> = UseAsyncStateBaseOptions &
  UseAsyncStateImmediateOptions<Args>;

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
  options: UseAsyncStateOptions<NoInferCompat<Args>> = {} as UseAsyncStateOptions<
    NoInferCompat<Args>
  >
): UseAsyncStateReturn<T, Args> {
  const state = createSignal(initialState);
  const isLoading = createSignal(false);
  const error = createSignal<unknown>(null);

  let callId = 0;
  let disposed = false;

  const execute = async (...args: Args): Promise<T> => {
    if (disposed) {
      return state();
    }

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
        if (!disposed && id === callId) {
          options.onError?.(err);
        }
      }
      throw err;
    } finally {
      if (id === callId) {
        isLoading(false);
      }
    }
  };

  if (options.immediate) {
    const immediateArgs = options.immediateArgs ?? ([] as unknown as Args);
    void execute(...immediateArgs).catch(() => {
      // ignore by default; error signal + onError handle it
    });
  }

  tryOnDestroy(() => {
    disposed = true;
    callId += 1;
    isLoading(false);
  });

  return {
    state,
    isLoading,
    error,
    execute
  };
}
