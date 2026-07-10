import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useEventListener } from '../../src/event/useEventListener';

describe('useEventListener', () => {
  it('binds and handles event', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(target, 'ping', handler);
    });

    target.dispatchEvent(new Event('ping'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports multiple events', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(target, ['foo', 'bar'], handler);
    });

    target.dispatchEvent(new Event('foo'));
    target.dispatchEvent(new Event('bar'));
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('rolls back listeners when setup fails partway through', () => {
    const firstTarget = new EventTarget();
    const failingTarget = new EventTarget();
    const setupError = new Error('listener setup failed');
    const addFailingListener = failingTarget.addEventListener.bind(failingTarget);
    vi.spyOn(failingTarget, 'addEventListener').mockImplementation((...args) => {
      addFailingListener(...args);
      throw setupError;
    });
    const handler = vi.fn();

    expect(() =>
      createRoot(() => useEventListener([firstTarget, failingTarget], 'partial', handler))
    ).toThrow(setupError);

    firstTarget.dispatchEvent(new Event('partial'));
    failingTarget.dispatchEvent(new Event('partial'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('continues removing listeners after one cleanup fails', () => {
    const firstTarget = new EventTarget();
    const secondTarget = new EventTarget();
    const cleanupError = new Error('listener cleanup failed');
    const removeFirstListener = firstTarget.removeEventListener.bind(firstTarget);
    let failCleanup = true;
    vi.spyOn(firstTarget, 'removeEventListener').mockImplementation((...args) => {
      removeFirstListener(...args);
      if (failCleanup) {
        failCleanup = false;
        throw cleanupError;
      }
    });
    const handler = vi.fn();
    const { value: controls } = createRoot(() =>
      useEventListener([firstTarget, secondTarget], 'cleanup', handler)
    );

    expect(() => controls.stop()).toThrow(cleanupError);

    firstTarget.dispatchEvent(new Event('cleanup'));
    secondTarget.dispatchEvent(new Event('cleanup'));
    expect(handler).not.toHaveBeenCalled();
    expect(controls.active()).toBe(false);

    controls.start();
    firstTarget.dispatchEvent(new Event('cleanup'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('preserves a listener restarted during cleanup', () => {
    const target = new EventTarget();
    const removeListener = target.removeEventListener.bind(target);
    let restartOnRemove = false;
    const controlsRef = {
      current: undefined as ReturnType<typeof useEventListener> | undefined
    };
    vi.spyOn(target, 'removeEventListener').mockImplementation((...args) => {
      removeListener(...args);
      if (restartOnRemove) {
        restartOnRemove = false;
        controlsRef.current!.start();
      }
    });
    const handler = vi.fn();
    const controls = createRoot(() => useEventListener(target, 'reentrant', handler)).value;
    controlsRef.current = controls;

    restartOnRemove = true;
    controls.stop();
    target.dispatchEvent(new Event('reentrant'));

    expect(controls.active()).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('keeps the listener created by a refresh reentered from removal', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const activeListeners = new Set<EventListenerOrEventListenerObject>();
    const addListener = target.addEventListener.bind(target);
    const removeListener = target.removeEventListener.bind(target);
    const addListenerSpy = vi
      .spyOn(target, 'addEventListener')
      .mockImplementation((...args) => {
        if (args[1]) {
          activeListeners.add(args[1]);
        }
        addListener(...args);
      });
    let refreshOnRemove = false;
    let refresh = () => {};
    vi.spyOn(target, 'removeEventListener').mockImplementation((...args) => {
      removeListener(...args);
      if (args[1]) {
        activeListeners.delete(args[1]);
      }
      if (refreshOnRemove) {
        refreshOnRemove = false;
        refresh();
      }
    });
    const root = createRoot(() => useEventListener(target, 'reentrant-refresh', handler));
    refresh = root.value.refresh;
    refreshOnRemove = true;

    root.value.refresh();

    expect(addListenerSpy).toHaveBeenCalledTimes(2);
    expect(activeListeners.size).toBe(1);
    target.dispatchEvent(new Event('reentrant-refresh'));
    expect(handler).toHaveBeenCalledOnce();

    root.value.stop();
    expect(activeListeners.size).toBe(0);
  });

  it('supports stop and start controls', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    const { value: controls } = createRoot(() => useEventListener(target, 'tick', handler));

    target.dispatchEvent(new Event('tick'));
    controls.stop();
    target.dispatchEvent(new Event('tick'));
    controls.start();
    target.dispatchEvent(new Event('tick'));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('removes listeners on dispose', () => {
    const target = new EventTarget();
    const handler = vi.fn();

    const { dispose } = createRoot(() => {
      useEventListener(target, 'pong', handler);
    });

    dispose();
    target.dispatchEvent(new Event('pong'));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('does not restart after owner disposal', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const addListener = vi.spyOn(target, 'addEventListener');
    const root = createRoot(() => useEventListener(target, 'terminal', handler));

    root.dispose();
    root.value.start();
    root.value.refresh();
    target.dispatchEvent(new Event('terminal'));

    expect(root.value.active()).toBe(false);
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not rebind when removal disposes the owner', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const addListener = vi.spyOn(target, 'addEventListener');
    const removeListener = target.removeEventListener.bind(target);
    let disposeOnRemove = false;
    let dispose = () => {};
    vi.spyOn(target, 'removeEventListener').mockImplementation((...args) => {
      removeListener(...args);
      if (disposeOnRemove) {
        dispose();
      }
    });
    const root = createRoot(() => useEventListener(target, 'remove-dispose', handler));
    dispose = root.dispose;
    disposeOnRemove = true;

    root.value.refresh();
    target.dispatchEvent(new Event('remove-dispose'));

    expect(root.value.active()).toBe(false);
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not bind when target resolution disposes the owner', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const addListener = vi.spyOn(target, 'addEventListener');
    let disposeOnRead = false;
    let dispose = () => {};
    const root = createRoot(() =>
      useEventListener(
        () => {
          if (disposeOnRead) {
            dispose();
          }
          return target;
        },
        'target-dispose',
        handler
      )
    );
    dispose = root.dispose;
    disposeOnRead = true;

    root.value.refresh();

    expect(root.value.active()).toBe(false);
    expect(addListener).toHaveBeenCalledTimes(1);
  });

  it('rolls back a listener when registration disposes the owner', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const addListener = target.addEventListener.bind(target);
    const removeListener = vi.spyOn(target, 'removeEventListener');
    let disposeOnAdd = false;
    let dispose = () => {};
    vi.spyOn(target, 'addEventListener').mockImplementation((...args) => {
      addListener(...args);
      if (disposeOnAdd) {
        dispose();
      }
    });
    const root = createRoot(() =>
      useEventListener(target, 'add-dispose', handler, { immediate: false })
    );
    dispose = root.dispose;
    disposeOnAdd = true;

    root.value.start();
    target.dispatchEvent(new Event('add-dispose'));

    expect(root.value.active()).toBe(false);
    expect(removeListener).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes abort signal to listener options', () => {
    const target = new EventTarget();
    const handler = vi.fn();
    const controller = new AbortController();

    createRoot(() => {
      useEventListener(target, 'abortable', handler, { signal: controller.signal });
    });

    target.dispatchEvent(new Event('abortable'));
    controller.abort();
    target.dispatchEvent(new Event('abortable'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reacts to target changes', async () => {
    const targetA = new EventTarget();
    const targetB = new EventTarget();
    const handler = vi.fn();
    const currentTarget = createSignal<EventTarget>(targetA);

    createRoot(() => {
      useEventListener(() => currentTarget(), 'move', handler);
    });

    targetA.dispatchEvent(new Event('move'));
    currentTarget(targetB);
    await Promise.resolve();

    targetA.dispatchEvent(new Event('move'));
    targetB.dispatchEvent(new Event('move'));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('binds ref-like target after it is assigned', async () => {
    const target = new EventTarget();
    const ref = { current: null as EventTarget | null };
    const handler = vi.fn();

    createRoot(() => {
      useEventListener(ref, 'ready', handler);
    });

    ref.current = target;
    await Promise.resolve();

    target.dispatchEvent(new Event('ready'));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retries an unresolved ref when start is called while active', async () => {
    const target = new EventTarget();
    const ref = { current: null as EventTarget | null };
    const handler = vi.fn();
    const { value: controls } = createRoot(() => useEventListener(ref, 'late', handler));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = target;
    controls.start();
    target.dispatchEvent(new Event('late'));

    expect(controls.active()).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('refreshes listeners after a non-reactive ref changes', () => {
    const targetA = new EventTarget();
    const targetB = new EventTarget();
    const ref = { current: targetA as EventTarget | null };
    const handler = vi.fn();
    const { value: controls } = createRoot(() => useEventListener(ref, 'refresh', handler));

    ref.current = targetB;
    controls.refresh();
    targetA.dispatchEvent(new Event('refresh'));
    targetB.dispatchEvent(new Event('refresh'));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
