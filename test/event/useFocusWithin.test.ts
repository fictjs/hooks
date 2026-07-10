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

  it('keeps focused true for an adopted child from another realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const foreignWindow = iframe.contentWindow as Window & typeof globalThis;
    const foreignChild = iframe.contentDocument!.createElement('input');
    const target = document.createElement('div');
    const first = document.createElement('input');
    const targetWindow = target.ownerDocument.defaultView as Window & typeof globalThis;
    const adoptedChild = target.ownerDocument.adoptNode(foreignChild);
    target.append(first, adoptedChild);
    document.body.appendChild(target);
    const { value: state, dispose } = createRoot(() => useFocusWithin(target));

    expect(adoptedChild).toBeInstanceOf(foreignWindow.Node);
    expect(adoptedChild).not.toBeInstanceOf(targetWindow.Node);

    first.dispatchEvent(new targetWindow.FocusEvent('focusin', { bubbles: true }));
    first.dispatchEvent(
      new targetWindow.FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: adoptedChild
      })
    );

    expect(state.focused()).toBe(true);

    dispose();
    target.remove();
    iframe.remove();
  });

  it('treats a spoofed non-node related target as outside', () => {
    const target = document.createElement('div');
    const child = document.createElement('input');
    target.appendChild(child);
    const { value: state } = createRoot(() => useFocusWithin(target));

    child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);

    const realmWindow = child.ownerDocument.defaultView as Window & typeof globalThis;
    const relatedTarget = new realmWindow.EventTarget();
    Object.defineProperty(relatedTarget, 'nodeType', { value: 1 });
    child.dispatchEvent(
      new realmWindow.FocusEvent('focusout', {
        bubbles: true,
        relatedTarget
      })
    );

    expect(state.focused()).toBe(false);
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

  it('resets when a ref-like target is refreshed', () => {
    const first = document.createElement('div');
    const firstChild = document.createElement('input');
    const second = document.createElement('div');
    const secondChild = document.createElement('input');
    first.appendChild(firstChild);
    second.appendChild(secondChild);
    const ref = { current: first as Element | null };
    const { value: state } = createRoot(() => useFocusWithin(ref));

    firstChild.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);

    ref.current = second;
    state.refresh();

    expect(state.focused()).toBe(false);
    firstChild.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(false);
    secondChild.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(state.focused()).toBe(true);
  });

  it('supports initial fallback without target', () => {
    const { value: state } = createRoot(() =>
      useFocusWithin(null, {
        initialValue: true
      })
    );

    expect(state.focused()).toBe(true);
  });

  it('refreshes a ref-like target assigned after initial setup', async () => {
    const target = document.createElement('div');
    const child = document.createElement('input');
    const ref = { current: null as Element | null };
    target.appendChild(child);
    const { value: state } = createRoot(() => useFocusWithin(ref));

    await Promise.resolve();
    ref.current = target;
    state.refresh();
    child.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    expect(state.focused()).toBe(true);
  });
});
