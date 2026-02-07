import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it } from 'vitest';
import { useScroll } from '../../src/browser/useScroll';

describe('useScroll', () => {
  it('reads and updates window scroll position', () => {
    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 10 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 20 });

    const { value: state } = createRoot(() => useScroll());
    expect(state.x()).toBe(10);
    expect(state.y()).toBe(20);

    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 40 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 50 });
    window.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(40);
    expect(state.y()).toBe(50);
  });

  it('tracks element scroll target', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 5, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 6, writable: true });

    const { value: state } = createRoot(() => useScroll({ target: element }));
    expect(state.x()).toBe(5);
    expect(state.y()).toBe(6);

    element.scrollLeft = 15;
    element.scrollTop = 16;
    element.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(15);
    expect(state.y()).toBe(16);
  });

  it('reacts to target accessor changes', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    Object.defineProperty(a, 'scrollLeft', { configurable: true, value: 1, writable: true });
    Object.defineProperty(a, 'scrollTop', { configurable: true, value: 2, writable: true });
    Object.defineProperty(b, 'scrollLeft', { configurable: true, value: 30, writable: true });
    Object.defineProperty(b, 'scrollTop', { configurable: true, value: 40, writable: true });

    const current = createSignal<Element>(a);
    const { value: state } = createRoot(() =>
      useScroll({
        target: () => current()
      })
    );

    expect(state.x()).toBe(1);
    expect(state.y()).toBe(2);

    current(b);
    await Promise.resolve();
    expect(state.x()).toBe(30);
    expect(state.y()).toBe(40);
  });

  it('uses fallback values without target/window', () => {
    const { value: state } = createRoot(() =>
      useScroll({
        target: null,
        window: null,
        initialX: 7,
        initialY: 8
      })
    );

    expect(state.x()).toBe(7);
    expect(state.y()).toBe(8);
  });

  it('supports shouldUpdate guard', () => {
    const element = document.createElement('div');
    Object.defineProperty(element, 'scrollLeft', { configurable: true, value: 0, writable: true });
    Object.defineProperty(element, 'scrollTop', { configurable: true, value: 0, writable: true });

    const { value: state } = createRoot(() =>
      useScroll({
        target: element,
        shouldUpdate(next) {
          return next.y % 2 === 0;
        }
      })
    );

    element.scrollTop = 1;
    element.dispatchEvent(new Event('scroll'));
    expect(state.y()).toBe(0);

    element.scrollTop = 2;
    element.dispatchEvent(new Event('scroll'));
    expect(state.y()).toBe(2);
  });
});
