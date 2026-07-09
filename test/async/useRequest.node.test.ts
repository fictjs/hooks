// @vitest-environment node

import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useRequest, type UseRequestCacheEntry } from '../../src/async/useRequest';

describe('useRequest in node', () => {
  it('does not share the default cache across SSR hook instances', async () => {
    const service = vi.fn(async () => 42);
    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'user-profile'
      })
    ).value;

    await first.runAsync();

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'user-profile'
      })
    ).value;

    expect(second.data()).toBeUndefined();
  });

  it('allows explicit request-scoped cache sharing on the server', async () => {
    const service = vi.fn(async () => 42);
    const cacheProvider = new Map<string, UseRequestCacheEntry<number>>();
    const first = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'user-profile',
        cacheProvider
      })
    ).value;

    await first.runAsync();

    const second = createRoot(() =>
      useRequest(service, {
        manual: true,
        cacheKey: 'user-profile',
        cacheProvider
      })
    ).value;

    expect(second.data()).toBe(42);
  });
});
