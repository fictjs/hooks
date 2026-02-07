import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useWindowScroll } from '../../src/browser/useWindowScroll';

describe('useWindowScroll', () => {
  it('reads current window scroll position', () => {
    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 12 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 34 });

    const { value: state } = createRoot(() => useWindowScroll());

    expect(state.x()).toBe(12);
    expect(state.y()).toBe(34);
  });

  it('updates on window scroll event', () => {
    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 0 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 0 });

    const { value: state } = createRoot(() => useWindowScroll());

    Object.defineProperty(window, 'pageXOffset', { configurable: true, value: 80 });
    Object.defineProperty(window, 'pageYOffset', { configurable: true, value: 90 });
    window.dispatchEvent(new Event('scroll'));

    expect(state.x()).toBe(80);
    expect(state.y()).toBe(90);
  });

  it('uses fallback values when window is unavailable', () => {
    const { value: state } = createRoot(() =>
      useWindowScroll({
        window: null,
        initialX: 3,
        initialY: 4
      })
    );

    expect(state.x()).toBe(3);
    expect(state.y()).toBe(4);
  });
});
