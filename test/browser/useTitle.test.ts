import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useTitle } from '../../src/browser/useTitle';

describe('useTitle', () => {
  it('sets document title from string input', () => {
    document.title = 'before';

    const { value: state } = createRoot(() => useTitle('Fict Hooks'));

    expect(document.title).toBe('Fict Hooks');
    expect(state.title()).toBe('Fict Hooks');
  });

  it('reacts to accessor updates', async () => {
    document.title = 'before';
    const source = createSignal('initial');

    const { value: state } = createRoot(() => useTitle(() => source()));

    expect(document.title).toBe('initial');
    source('next');
    await Promise.resolve();

    expect(document.title).toBe('next');
    expect(state.title()).toBe('next');
  });

  it('updates document title when returned signal is written', () => {
    document.title = 'before';

    const { value: state } = createRoot(() => useTitle('initial'));

    (state.title as (next: string) => void)('manual');

    expect(document.title).toBe('manual');
    expect(state.title()).toBe('manual');
  });

  it('restores previous title on dispose when enabled', () => {
    document.title = 'original';

    const { dispose } = createRoot(() =>
      useTitle('temp', {
        restoreOnUnmount: true
      })
    );

    expect(document.title).toBe('temp');
    dispose();
    expect(document.title).toBe('original');
  });

  it('does not overwrite the restored title after a signal update disposes the owner', () => {
    document.title = 'original';
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 'next') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() => useTitle('initial', { restoreOnUnmount: true }));
      dispose = root.dispose;

      (root.value.title as (next: string) => void)('next');

      expect(root.value.title()).toBe('next');
      expect(document.title).toBe('original');
      (root.value.title as (next: string) => void)('ignored');
      expect(document.title).toBe('original');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('works without document reference', () => {
    const { value: state } = createRoot(() =>
      useTitle('server-side', {
        document: null
      })
    );

    expect(state.title()).toBe('server-side');
  });
});
