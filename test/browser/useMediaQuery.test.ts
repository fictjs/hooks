import { createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
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

class LegacyMediaQueryList {
  readonly media: string;
  matches: boolean;
  private listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  addListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeListener(listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  setMatches(value: boolean): void {
    this.matches = value;
    const event = { matches: value } as MediaQueryListEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
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

  it('does not update when reading a change event disposes the owner', () => {
    const mql = new MockMediaQueryList('(prefers-reduced-motion: reduce)', false);
    const windowRef = { matchMedia: vi.fn(() => mql) } as unknown as Window;
    let dispose = () => {};
    const root = createRoot(() =>
      useMediaQuery('(prefers-reduced-motion: reduce)', { window: windowRef })
    );
    dispose = root.dispose;
    const event = new Event('change') as MediaQueryListEvent;
    Object.defineProperty(event, 'matches', {
      configurable: true,
      get() {
        dispose();
        return true;
      }
    });

    mql.dispatchEvent(event);

    expect(root.value.matches()).toBe(false);
  });

  it('rolls back a listener whose registration disposes the owner', async () => {
    const query = createSignal('first');
    let dispose = () => {};
    let disposeOnAdd = false;
    const listenerSets = new Map<string, Set<EventListener>>();
    const windowRef = {
      matchMedia(value: string) {
        const listeners = new Set<EventListener>();
        listenerSets.set(value, listeners);
        return {
          matches: false,
          addEventListener(_type: string, listener: EventListener) {
            listeners.add(listener);
            if (disposeOnAdd) {
              disposeOnAdd = false;
              dispose();
            }
          },
          removeEventListener(_type: string, listener: EventListener) {
            listeners.delete(listener);
          }
        } as unknown as MediaQueryList;
      }
    } as unknown as Window;
    const root = createRoot(() => useMediaQuery(() => query(), { window: windowRef }));
    dispose = root.dispose;
    expect(listenerSets.get('first')?.size).toBe(1);
    disposeOnAdd = true;

    query('second');
    await Promise.resolve();
    await Promise.resolve();

    expect(listenerSets.get('first')?.size).toBe(0);
    expect(listenerSets.get('second')?.size).toBe(0);
  });

  it('supports legacy media query listeners', () => {
    const mql = new LegacyMediaQueryList('(prefers-reduced-motion: reduce)', false);

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mql)
    });

    const { value: state, dispose } = createRoot(() =>
      useMediaQuery('(prefers-reduced-motion: reduce)')
    );

    mql.setMatches(true);
    expect(state.matches()).toBe(true);

    dispose();
    mql.setMatches(false);
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
