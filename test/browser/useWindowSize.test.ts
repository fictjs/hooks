import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useWindowSize } from '../../src/browser/useWindowSize';

describe('useWindowSize', () => {
  it('reads current window size', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });

    const { value: state } = createRoot(() => useWindowSize());

    expect(state.width()).toBe(1024);
    expect(state.height()).toBe(768);
  });

  it('updates on resize event', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    const { value: state } = createRoot(() => useWindowSize());

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    window.dispatchEvent(new Event('resize'));

    expect(state.width()).toBe(1280);
    expect(state.height()).toBe(720);
  });

  it('uses initial fallback without window', () => {
    const { value: state } = createRoot(() =>
      useWindowSize({ window: null, initialWidth: 320, initialHeight: 480 })
    );

    expect(state.width()).toBe(320);
    expect(state.height()).toBe(480);
  });
});
