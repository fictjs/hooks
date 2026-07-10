import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useKeyPress } from '../../src/event/useKeyPress';

describe('useKeyPress', () => {
  it('matches a simple key filter', () => {
    const handler = vi.fn();
    const root = createRoot(() => useKeyPress('a', handler));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('matches combination keys with exactMatch', () => {
    const handler = vi.fn();
    const root = createRoot(() =>
      useKeyPress('ctrl.k', handler, {
        exactMatch: true
      })
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true
      })
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true
      })
    );

    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('matches punctuation keys used as combo separators', () => {
    const plus = vi.fn();
    const dot = vi.fn();
    const ctrlPlus = vi.fn();
    const root = createRoot(() => {
      useKeyPress('+', plus);
      useKeyPress('.', dot);
      useKeyPress('ctrl.+', ctrlPlus, { exactMatch: true });
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '.' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true }));

    expect(plus).toHaveBeenCalledTimes(2);
    expect(dot).toHaveBeenCalledTimes(1);
    expect(ctrlPlus).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('supports multiple key filters', () => {
    const handler = vi.fn();
    const root = createRoot(() => useKeyPress(['enter', 'escape'], handler));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(handler).toHaveBeenCalledTimes(2);
    root.dispose();
  });

  it('supports predicate key filter', () => {
    const handler = vi.fn();
    const root = createRoot(() =>
      useKeyPress((event) => event.key === 'x', handler, {
        events: 'keyup'
      })
    );

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('does not handle an event when the predicate stops the controls', () => {
    const handler = vi.fn();
    const controlsRef: { current?: ReturnType<typeof useKeyPress> } = {};
    const root = createRoot(() =>
      useKeyPress(
        () => {
          controlsRef.current?.stop();
          return true;
        },
        handler,
        { preventDefault: true }
      )
    );
    controlsRef.current = root.value;
    const event = new KeyboardEvent('keydown', { key: 'x', cancelable: true });

    window.dispatchEvent(event);

    expect(root.value.active()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    root.dispose();
  });

  it('invalidates an event when the predicate stops and restarts the controls', () => {
    const handler = vi.fn();
    const controlsRef: { current?: ReturnType<typeof useKeyPress> } = {};
    const root = createRoot(() =>
      useKeyPress(() => {
        controlsRef.current?.stop();
        controlsRef.current?.start();
        return true;
      }, handler)
    );
    controlsRef.current = root.value;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));

    expect(root.value.active()).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    root.dispose();
  });

  it('exposes start and stop controls', () => {
    const handler = vi.fn();
    const { value: controls, dispose } = createRoot(() => useKeyPress('z', handler));

    controls.stop();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(handler).toHaveBeenCalledTimes(0);

    controls.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    expect(handler).toHaveBeenCalledTimes(1);

    dispose();
  });

  it('supports preventDefault option', () => {
    const handler = vi.fn();
    const root = createRoot(() =>
      useKeyPress('a', handler, {
        preventDefault: true
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('can ignore repeated keydown events', () => {
    const handler = vi.fn();
    const root = createRoot(() => useKeyPress('a', handler, { ignoreRepeat: true }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', repeat: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });

  it('ignores composing keyboard events by default', () => {
    const handler = vi.fn();
    const root = createRoot(() => useKeyPress('a', handler));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', isComposing: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(handler).toHaveBeenCalledTimes(1);
    root.dispose();
  });
});
