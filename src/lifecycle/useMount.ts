import { onMount, type Cleanup } from '@fictjs/runtime';

export type MountCallback = () => void | Cleanup;

/**
 * Register a callback that runs after the current root mounts.
 *
 * @fictReturn {}
 */
export function useMount(callback: MountCallback): void {
  onMount(callback);
}
