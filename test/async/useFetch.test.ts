import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useFetch } from '../../src/async/useFetch';

describe('useFetch', () => {
  it('fetches and parses JSON', async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    const { value: state } = createRoot(() =>
      useFetch<{ ok: boolean }>('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    await state.execute();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(state.data()).toEqual({ ok: true });
    expect(state.status()).toBe(200);
    expect(state.error()).toBeNull();
  });

  it('supports manual abort', async () => {
    const mockFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return new Response('');
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    const promise = state.execute();
    state.abort();
    await promise;

    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);
  });

  it('stores error for failed responses', async () => {
    const onError = vi.fn();
    const mockFetch = vi.fn(async () => new Response('fail', { status: 500 }));

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        onError
      })
    );

    await state.execute();

    expect((state.error() as Error).message).toContain('500');
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
