import type { Cleanup } from '@fictjs/runtime';
import { tryOnDestroy } from '../internal/lifecycle';

export type UnmountCallback = () => void | Cleanup;

/**
 * Register cleanup logic for root disposal.
 *
 * @fictReturn {}
 */
export function useUnmount(callback: UnmountCallback): void {
  tryOnDestroy(callback);
}
