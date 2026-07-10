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

  it('refreshes a ref-like target assigned after initial setup', async () => {
    const target = document.createElement('div');
    const ref = { current: null as Element | null };
    const { value: state } = createRoot(() => useHover(ref));

    await Promise.resolve();
    ref.current = target;
    state.refresh();
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

  it('resets when a ref-like target is refreshed', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const ref = { current: first as Element | null };
    const { value: state } = createRoot(() => useHover(ref));

    first.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(true);

    ref.current = second;
    state.refresh();

    expect(state.hovered()).toBe(false);
    first.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(false);
    second.dispatchEvent(new Event('pointerenter'));
    expect(state.hovered()).toBe(true);
  });

  it('uses initial fallback when target is unavailable', () => {
    const { value: state } = createRoot(() =>
      useHover(null, {
        initialValue: true
      })
    );

    expect(state.hovered()).toBe(true);
  });

  it('does not reset after a refreshed target accessor disposes the owner', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      useHover(() => {
        if (disposeOnRead) {
          dispose();
          return second;
        }
        return first;
      })
    );
    dispose = root.dispose;
    first.dispatchEvent(new Event('pointerenter'));
    expect(root.value.hovered()).toBe(true);
    disposeOnRead = true;

    root.value.refresh();
    root.value.refresh();

    expect(root.value.hovered()).toBe(true);
  });
});
