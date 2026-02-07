import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClipboard } from '../../src/clipboard/useClipboard';

describe('useClipboard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies text with Clipboard API', async () => {
    const writeText = vi.fn(async () => {});
    const navigatorRef = {
      clipboard: {
        writeText
      }
    } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useClipboard({
        navigator: navigatorRef as never,
        window,
        document
      })
    );

    const ok = await state.copy('hello');

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(state.text()).toBe('hello');
    expect(state.copied()).toBe(true);
  });

  it('resets copied state after timeout', async () => {
    vi.useFakeTimers();

    const writeText = vi.fn(async () => {});
    const navigatorRef = {
      clipboard: {
        writeText
      }
    } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useClipboard({ navigator: navigatorRef as never, window, document, copiedDuring: 100 })
    );

    await state.copy('value');
    expect(state.copied()).toBe(true);

    vi.advanceTimersByTime(100);
    expect(state.copied()).toBe(false);
  });

  it('returns false when unsupported', async () => {
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: null, document: null, window: null })
    );

    expect(state.isSupported()).toBe(false);
    const ok = await state.copy('x');
    expect(ok).toBe(false);
  });
});
