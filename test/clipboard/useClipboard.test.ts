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

  it('keeps the latest state when writes settle out of order', async () => {
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const secondWrite = new Promise<void>((resolve) => {
      resolveSecond = resolve;
    });
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockReturnValueOnce(firstWrite)
      .mockReturnValueOnce(secondWrite);

    const { value: state } = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window, document })
    );

    const firstCopy = state.copy('first');
    const secondCopy = state.copy('second');

    resolveSecond();
    await expect(secondCopy).resolves.toBe(true);
    expect(state.text()).toBe('second');
    expect(state.copied()).toBe(true);

    resolveFirst();
    await expect(firstCopy).resolves.toBe(true);
    expect(state.text()).toBe('second');
    expect(state.copied()).toBe(true);
  });

  it('does not commit a pending write after dispose', async () => {
    vi.useFakeTimers();
    let resolveWrite!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        })
    );

    const root = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window, document })
    );
    const pendingCopy = root.value.copy('pending');

    root.dispose();
    resolveWrite();

    await expect(pendingCopy).resolves.toBe(true);
    expect(root.value.copied()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
