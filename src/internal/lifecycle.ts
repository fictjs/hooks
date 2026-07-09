import { onCleanup } from '@fictjs/runtime';

export type LifecycleCleanup = () => void | (() => void);

export function tryOnDestroy(callback: LifecycleCleanup): void {
  onCleanup(() => {
    const cleanup = callback();
    if (typeof cleanup === 'function') {
      cleanup();
    }
  });
}
