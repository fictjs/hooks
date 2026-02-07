import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../../src/browser/useMediaQuery';

class MockMediaQueryList extends EventTarget {
  readonly media: string;
  matches: boolean;

  constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.addEventListener('change', listener as EventListener);
  }

  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.removeEventListener('change', listener as EventListener);
  }

  setMatches(value: boolean): void {
    this.matches = value;
    const event = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(event, 'matches', { configurable: true, value });
    this.dispatchEvent(event);
  }
}

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia
    });
  });

  it('reads initial match result', () => {
    const mql = new MockMediaQueryList('(min-width: 768px)', true);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mql)
    });

    const { value: state } = createRoot(() => useMediaQuery('(min-width: 768px)'));

    expect(state.matches()).toBe(true);
    expect(state.isSupported()).toBe(true);
  });

  it('updates on media query changes', () => {
    const mql = new MockMediaQueryList('(prefers-reduced-motion: reduce)', false);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mql)
    });

    const { value: state } = createRoot(() => useMediaQuery('(prefers-reduced-motion: reduce)'));

    mql.setMatches(true);
    expect(state.matches()).toBe(true);
  });

  it('falls back when unsupported', () => {
    const { value: state } = createRoot(() =>
      useMediaQuery('(prefers-color-scheme: dark)', { window: null, initialValue: true })
    );

    expect(state.matches()).toBe(true);
    expect(state.isSupported()).toBe(false);
  });
});
