import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSize } from '../../src/browser/useSize';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  static observeError: unknown;
  static disconnectError: unknown;

  readonly observe = vi.fn(() => {
    if (MockResizeObserver.observeError) {
      throw MockResizeObserver.observeError;
    }
  });
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn(() => {
    if (MockResizeObserver.disconnectError) {
      throw MockResizeObserver.disconnectError;
    }
  });

  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  trigger(entries: ResizeObserverEntry[]) {
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

function mockRect(target: Element, rect: Partial<DOMRect>) {
  const x = rect.x ?? rect.left ?? 0;
  const y = rect.y ?? rect.top ?? 0;
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;
  const top = rect.top ?? y;
  const left = rect.left ?? x;
  const right = rect.right ?? left + width;
  const bottom = rect.bottom ?? top + height;

  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    width,
    height,
    top,
    left,
    right,
    bottom,
    toJSON() {
      return {};
    }
  } as DOMRect);
}

describe('useSize', () => {
  const windowRef = window as Window & { ResizeObserver?: typeof ResizeObserver };
  const originalWindowResizeObserver = windowRef.ResizeObserver;
  const originalGlobalResizeObserver = globalThis.ResizeObserver;

  afterEach(() => {
    windowRef.ResizeObserver = originalWindowResizeObserver;
    globalThis.ResizeObserver = originalGlobalResizeObserver;
    MockResizeObserver.instances = [];
    MockResizeObserver.observeError = undefined;
    MockResizeObserver.disconnectError = undefined;
    vi.restoreAllMocks();
  });

  it('observes target and updates size from ResizeObserver', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 60, top: 10, left: 20 });

    const { value: state } = createRoot(() => useSize(element));
    const instance = MockResizeObserver.instances[0]!;

    expect(instance.observe).toHaveBeenCalledWith(element, { box: 'border-box' });
    expect(state.width()).toBe(100);
    expect(state.height()).toBe(60);
    expect(state.top()).toBe(10);
    expect(state.left()).toBe(20);

    mockRect(element, { width: 120, height: 72, top: 12, left: 25 });
    instance.trigger([
      {
        target: element,
        contentRect: {
          width: 120,
          height: 72,
          top: 0,
          left: 0,
          right: 120,
          bottom: 72,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          }
        } as DOMRectReadOnly,
        contentBoxSize: [{ inlineSize: 100, blockSize: 52 }],
        borderBoxSize: [{ inlineSize: 120, blockSize: 72 }]
      } as unknown as ResizeObserverEntry
    ]);

    expect(state.width()).toBe(120);
    expect(state.height()).toBe(72);
    expect(state.top()).toBe(12);
    expect(state.left()).toBe(25);
  });

  it('uses the requested ResizeObserver box for size updates', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 60, top: 10, left: 20 });

    const { value: state } = createRoot(() => useSize(element, { box: 'border-box' }));
    const instance = MockResizeObserver.instances[0]!;

    expect(instance.observe).toHaveBeenCalledWith(element, { box: 'border-box' });

    mockRect(element, { width: 100, height: 60, top: 12, left: 24 });
    instance.trigger([
      {
        target: element,
        contentRect: {
          width: 100,
          height: 60,
          top: 0,
          left: 0,
          right: 100,
          bottom: 60,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          }
        } as DOMRectReadOnly,
        borderBoxSize: [{ inlineSize: 140, blockSize: 80 }]
      } as unknown as ResizeObserverEntry
    ]);

    expect(state.width()).toBe(140);
    expect(state.height()).toBe(80);
    expect(state.top()).toBe(12);
    expect(state.left()).toBe(24);
  });

  it('maps logical observer axes to physical size for vertical writing modes', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    element.style.writingMode = 'vertical-rl';
    mockRect(element, { width: 80, height: 180 });

    const { value: state } = createRoot(() => useSize(element));
    const instance = MockResizeObserver.instances[0]!;
    instance.trigger([
      {
        target: element,
        contentRect: {
          width: 120,
          height: 240
        } as DOMRectReadOnly,
        borderBoxSize: [{ inlineSize: 240, blockSize: 120 }]
      } as unknown as ResizeObserverEntry
    ]);

    expect(state.width()).toBe(120);
    expect(state.height()).toBe(240);
  });

  it('rebinds observer when target changes', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const a = document.createElement('div');
    const b = document.createElement('div');
    mockRect(a, { width: 40, height: 20 });
    mockRect(b, { width: 80, height: 30 });

    const target = createSignal<Element>(a);
    const { value: state } = createRoot(() => useSize(() => target()));
    const first = MockResizeObserver.instances[0]!;

    expect(first.observe).toHaveBeenCalledWith(a, { box: 'border-box' });
    target(b);
    await Promise.resolve();

    const second = MockResizeObserver.instances[1]!;
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.observe).toHaveBeenCalledWith(b, { box: 'border-box' });
    expect(state.width()).toBe(80);
    expect(state.height()).toBe(30);
  });

  it('ignores callbacks from refreshed and disposed observers', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const a = document.createElement('div');
    const b = document.createElement('div');
    mockRect(a, { width: 40, height: 20 });
    mockRect(b, { width: 80, height: 30 });

    const target = createSignal<Element>(a);
    const root = createRoot(() => useSize(() => target()));
    const first = MockResizeObserver.instances[0]!;

    target(b);
    await Promise.resolve();
    const second = MockResizeObserver.instances[1]!;

    first.trigger([
      {
        target: a,
        borderBoxSize: [{ inlineSize: 400, blockSize: 200 }]
      } as unknown as ResizeObserverEntry
    ]);
    expect(root.value.width()).toBe(80);
    expect(root.value.height()).toBe(30);

    second.trigger([
      {
        target: b,
        borderBoxSize: [{ inlineSize: 90, blockSize: 45 }]
      } as unknown as ResizeObserverEntry
    ]);
    expect(root.value.width()).toBe(90);
    expect(root.value.height()).toBe(45);

    root.dispose();
    second.trigger([
      {
        target: b,
        borderBoxSize: [{ inlineSize: 120, blockSize: 60 }]
      } as unknown as ResizeObserverEntry
    ]);
    expect(root.value.width()).toBe(90);
    expect(root.value.height()).toBe(45);
  });

  it('observes ref-like target after it is assigned', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 42, height: 24 });
    const ref = { current: null as Element | null };

    const { value: state, dispose } = createRoot(() => useSize(ref));
    ref.current = element;
    await Promise.resolve();

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element, { box: 'border-box' });
    expect(state.width()).toBe(42);
    expect(state.height()).toBe(24);

    dispose();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('refreshes observation after a non-reactive ref is assigned late', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    const element = document.createElement('div');
    mockRect(element, { width: 140, height: 70 });
    const ref = { current: null as Element | null };
    const root = createRoot(() => useSize(ref));

    await Promise.resolve();
    await Promise.resolve();
    ref.current = element;
    root.value.refresh();

    expect(root.value.width()).toBe(140);
    expect(root.value.height()).toBe(70);
    expect(MockResizeObserver.instances).toHaveLength(1);
    expect(MockResizeObserver.instances[0]!.observe).toHaveBeenCalledWith(element, {
      box: 'border-box'
    });
    root.dispose();
  });

  it('supports stop and start controls', async () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 60 });

    const { value: state } = createRoot(() => useSize(element));
    const first = MockResizeObserver.instances[0]!;

    state.stop();
    expect(state.active()).toBe(false);
    expect(first.disconnect).toHaveBeenCalledTimes(1);

    state.start();
    await Promise.resolve();
    const second = MockResizeObserver.instances[1]!;
    expect(state.active()).toBe(true);
    expect(second.observe).toHaveBeenCalledWith(element, { box: 'border-box' });
  });

  it('falls back when ResizeObserver is unavailable', () => {
    globalThis.ResizeObserver = undefined as never;

    const windowRef = new EventTarget() as Window;
    const element = document.createElement('div');
    mockRect(element, { width: 10, height: 20 });

    const { value: state } = createRoot(() => useSize(element, { window: windowRef }));
    expect(state.isSupported()).toBe(false);
    expect(state.width()).toBe(10);

    mockRect(element, { width: 30, height: 40 });
    windowRef.dispatchEvent(new Event('resize'));
    expect(state.width()).toBe(30);
    expect(state.height()).toBe(40);
  });

  it('updates position when scrolling changes the target rect', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 60, top: 100, left: 20 });
    const { value: state } = createRoot(() => useSize(element));

    expect(state.top()).toBe(100);
    expect(state.y()).toBe(100);

    mockRect(element, { width: 100, height: 60, top: -25, left: 20 });
    window.dispatchEvent(new Event('scroll'));

    expect(state.top()).toBe(-25);
    expect(state.y()).toBe(-25);
  });

  it('does not use global ResizeObserver when window is null', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 10, height: 20 });

    const { value: state } = createRoot(() => useSize(element, { window: null }));

    expect(state.isSupported()).toBe(false);
    expect(state.width()).toBe(10);
    expect(MockResizeObserver.instances).toHaveLength(0);
  });

  it('disconnects observer on dispose', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 100 });

    const { dispose } = createRoot(() => useSize(element));
    const instance = MockResizeObserver.instances[0]!;

    dispose();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects a failed observer without replacing the observe error', () => {
    windowRef.ResizeObserver = MockResizeObserver as never;
    MockResizeObserver.observeError = new Error('observe failed');
    MockResizeObserver.disconnectError = new Error('disconnect failed');

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 100 });

    expect(() => createRoot(() => useSize(element))).toThrow('observe failed');

    const instance = MockResizeObserver.instances[0]!;
    expect(instance.observe).toHaveBeenCalledWith(element, { box: 'border-box' });
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });
});
