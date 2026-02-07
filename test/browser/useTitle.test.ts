import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it } from 'vitest';
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

  it('works without document reference', () => {
    const { value: state } = createRoot(() =>
      useTitle('server-side', {
        document: null
      })
    );

    expect(state.title()).toBe('server-side');
  });
});
