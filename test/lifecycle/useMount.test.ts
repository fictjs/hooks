import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useMount } from '../../src/lifecycle/useMount';

describe('useMount', () => {
  it('runs callback after root creation', () => {
    const callback = vi.fn();

    createRoot(() => {
      useMount(callback);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('registers cleanup returned from callback', () => {
    const cleanup = vi.fn();

    const { dispose } = createRoot(() => {
      useMount(() => cleanup);
    });

    expect(cleanup).toHaveBeenCalledTimes(0);
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs immediately outside root', () => {
    const callback = vi.fn();
    useMount(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
