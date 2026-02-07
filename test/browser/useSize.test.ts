import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSize } from '../../src/browser/useSize';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

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
  const originalResizeObserver = globalThis.ResizeObserver;

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    MockResizeObserver.instances = [];
    vi.restoreAllMocks();
  });

  it('observes target and updates size from ResizeObserver', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 60, top: 10, left: 20 });

    const { value: state } = createRoot(() => useSize(element));
    const instance = MockResizeObserver.instances[0]!;

    expect(instance.observe).toHaveBeenCalledWith(element, undefined);
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
        } as DOMRectReadOnly
      } as unknown as ResizeObserverEntry
    ]);

    expect(state.width()).toBe(120);
    expect(state.height()).toBe(72);
    expect(state.top()).toBe(12);
    expect(state.left()).toBe(25);
  });

  it('rebinds observer when target changes', async () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const a = document.createElement('div');
    const b = document.createElement('div');
    mockRect(a, { width: 40, height: 20 });
    mockRect(b, { width: 80, height: 30 });

    const target = createSignal<Element>(a);
    const { value: state } = createRoot(() => useSize(() => target()));
    const first = MockResizeObserver.instances[0]!;

    expect(first.observe).toHaveBeenCalledWith(a, undefined);
    target(b);
    await Promise.resolve();

    const second = MockResizeObserver.instances[1]!;
    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(second.observe).toHaveBeenCalledWith(b, undefined);
    expect(state.width()).toBe(80);
    expect(state.height()).toBe(30);
  });

  it('supports stop and start controls', async () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

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
    expect(second.observe).toHaveBeenCalledWith(element, undefined);
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

  it('disconnects observer on dispose', () => {
    globalThis.ResizeObserver = MockResizeObserver as never;

    const element = document.createElement('div');
    mockRect(element, { width: 100, height: 100 });

    const { dispose } = createRoot(() => useSize(element));
    const instance = MockResizeObserver.instances[0]!;

    dispose();
    expect(instance.disconnect).toHaveBeenCalledTimes(1);
  });
});
