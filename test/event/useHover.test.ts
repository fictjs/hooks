import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it } from 'vitest';
import { useHover } from '../../src/event/useHover';

describe('useHover', () => {
  it('tracks pointer enter and leave events', () => {
    const target = document.createElement('div');
    const { value: state } = createRoot(() => useHover(target));

    expect(state.hovered()).toBe(false);

    target.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(true);

    target.dispatchEvent(new Event('pointerleave'));
    expect(state.hovered()).toBe(false);
  });

  it('supports ref-like target', () => {
    const target = document.createElement('div');
    const ref = { current: target as Element | null };
    const { value: state } = createRoot(() => useHover(ref));

    target.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(true);
  });

  it('resets when accessor target changes', async () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const current = createSignal<Element>(first);

    const { value: state } = createRoot(() => useHover(() => current()));
    first.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(true);

    current(second);
    await Promise.resolve();

    expect(state.hovered()).toBe(false);
  });

  it('uses initial fallback when target is unavailable', () => {
    const { value: state } = createRoot(() =>
      useHover(null, {
        initialValue: true
      })
    );

    expect(state.hovered()).toBe(true);
  });
});
