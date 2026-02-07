import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it } from 'vitest';
import { useFocusWithin } from '../../src/event/useFocusWithin';

describe('useFocusWithin', () => {
  it('sets focused to true on focusin', () => {
    const target = document.createElement('div');
    const child = document.createElement('input');
    target.appendChild(child);

    const { value: state } = createRoot(() => useFocusWithin(target));
    child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(state.focused()).toBe(true);
  });

  it('sets focused to false when focus leaves target', () => {
    const target = document.createElement('div');
    const child = document.createElement('input');
    const outside = document.createElement('button');
    target.appendChild(child);
    document.body.appendChild(outside);

    const { value: state } = createRoot(() => useFocusWithin(target));
    child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);

    child.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    expect(state.focused()).toBe(false);
  });

  it('keeps focused true when next focus stays inside target', () => {
    const target = document.createElement('div');
    const first = document.createElement('input');
    const second = document.createElement('input');
    target.append(first, second);

    const { value: state } = createRoot(() => useFocusWithin(target));
    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);

    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second }));
    expect(state.focused()).toBe(true);
  });

  it('resets when accessor target changes', async () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    const current = createSignal<Element>(first);

    const { value: state } = createRoot(() => useFocusWithin(() => current()));
    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);

    current(second);
    await Promise.resolve();
    expect(state.focused()).toBe(false);
  });

  it('supports initial fallback without target', () => {
    const { value: state } = createRoot(() =>
      useFocusWithin(null, {
        initialValue: true
      })
    );

    expect(state.focused()).toBe(true);
  });
});
