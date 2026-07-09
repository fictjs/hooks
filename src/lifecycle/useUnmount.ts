import { tryOnDestroy } from '../internal/lifecycle';

export type UnmountCallback = () => void | (() => void);

/**
 * Register cleanup logic for root disposal.
 *
 * @fictReturn {}
 */
export function useUnmount(callback: UnmountCallback): void {
  tryOnDestroy(callback);
}
