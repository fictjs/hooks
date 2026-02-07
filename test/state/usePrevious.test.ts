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
});
