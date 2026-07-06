import { onCleanup, type Cleanup } from '@fictjs/runtime';

export type LifecycleCleanup = () => void | Cleanup;

export function tryOnDestroy(callback: LifecycleCleanup): void {
  onCleanup(() => {
    const cleanup = callback();
    if (typeof cleanup === 'function') {
      cleanup();
    }
  });
}
