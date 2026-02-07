import { onDestroy, type Cleanup } from '@fictjs/runtime';

export type UnmountCallback = () => void | Cleanup;

/**
 * Register cleanup logic for root disposal.
 *
 * @fictReturn {}
 */
export function useUnmount(callback: UnmountCallback): void {
  onDestroy(callback);
}
