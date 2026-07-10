import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it } from 'vitest';
import { usePrevious } from '../../src/state/usePrevious';

describe('usePrevious', () => {
  it('tracks previous signal value', async () => {
    const source = createSignal(1);

    const { value: previous } = createRoot(() => usePrevious(() => source()));

    expect(previous()).toBeUndefined();

    source(2);
    await Promise.resolve();
    expect(previous()).toBe(1);

    source(3);
    await Promise.resolve();
    expect(previous()).toBe(2);
  });

  it('accepts static values', () => {
    const { value: previous } = createRoot(() => usePrevious('static'));
    expect(previous()).toBeUndefined();
  });

  it('does not update after reading the source disposes the owner', async () => {
    const source = createSignal(1);
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      usePrevious(() => {
        const current = source();
        if (disposeOnRead) {
          dispose();
        }
        return current;
      })
    );
    dispose = root.dispose;

    disposeOnRead = true;
    source(2);
    await Promise.resolve();

    expect(root.value()).toBeUndefined();
  });
});
