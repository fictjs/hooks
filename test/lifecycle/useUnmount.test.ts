import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useUnmount } from '../../src/lifecycle/useUnmount';

describe('useUnmount', () => {
  it('runs callback on root disposal', () => {
    const callback = vi.fn();

    const { dispose } = createRoot(() => {
      useUnmount(callback);
    });

    expect(callback).toHaveBeenCalledTimes(0);
    dispose();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs returned cleanup immediately after callback outside root', () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);

    useUnmount(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
