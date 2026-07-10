import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClipboard } from '../../src/clipboard/useClipboard';

function createClipboardDocument(execCommand: () => boolean): Document {
  const documentRef = document.implementation.createHTMLDocument();
  Object.defineProperty(documentRef, 'execCommand', {
    configurable: true,
    value: execCommand
  });
  return documentRef;
}

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

  it('falls back to execCommand and removes the temporary textarea', async () => {
    const execCommand = vi.fn(() => true);
    const documentRef = createClipboardDocument(execCommand);
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: null, document: documentRef, window })
    );

    await expect(state.copy('fallback')).resolves.toBe(true);

    expect(state.isSupported()).toBe(true);
    expect(state.text()).toBe('fallback');
    expect(state.copied()).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(documentRef.body.querySelector('textarea')).toBeNull();
  });

  it('reports a failed or throwing execCommand fallback', async () => {
    const failedDocument = createClipboardDocument(() => false);
    const throwingDocument = createClipboardDocument(() => {
      throw new Error('copy failed');
    });
    const { value: failedState } = createRoot(() =>
      useClipboard({ navigator: null, document: failedDocument, window })
    );
    const { value: throwingState } = createRoot(() =>
      useClipboard({ navigator: null, document: throwingDocument, window })
    );

    await expect(failedState.copy('failed')).resolves.toBe(false);
    await expect(throwingState.copy('throwing')).resolves.toBe(false);

    expect(failedState.copied()).toBe(false);
    expect(throwingState.copied()).toBe(false);
    expect(failedDocument.body.querySelector('textarea')).toBeNull();
    expect(throwingDocument.body.querySelector('textarea')).toBeNull();
  });

  it('returns false when the fallback document has no body', async () => {
    const execCommand = vi.fn(() => true);
    const documentRef = createClipboardDocument(execCommand);
    Object.defineProperty(documentRef, 'body', {
      configurable: true,
      value: null
    });
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: null, document: documentRef, window })
    );

    await expect(state.copy('missing body')).resolves.toBe(false);
    expect(state.copied()).toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('does not replace a successful fallback result with a cleanup error', async () => {
    const execCommand = vi.fn(() => true);
    const documentRef = createClipboardDocument(execCommand);
    const createElement = documentRef.createElement.bind(documentRef);
    vi.spyOn(documentRef, 'createElement').mockImplementation((tagName) => {
      const element = createElement(tagName);
      if (tagName === 'textarea') {
        vi.spyOn(element, 'remove').mockImplementation(() => {
          throw new Error('cleanup failed');
        });
      }
      return element;
    });
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: null, document: documentRef, window })
    );

    await expect(state.copy('copied')).resolves.toBe(true);
    expect(state.copied()).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(documentRef.body.querySelector('textarea')).toBeNull();
  });

  it('removes the fallback textarea when the element remove method is unavailable', async () => {
    const execCommand = vi.fn(() => true);
    const documentRef = createClipboardDocument(execCommand);
    const createElement = documentRef.createElement.bind(documentRef);
    vi.spyOn(documentRef, 'createElement').mockImplementation((tagName) => {
      const element = createElement(tagName);
      if (tagName === 'textarea') {
        Object.defineProperty(element, 'remove', {
          configurable: true,
          value: undefined
        });
      }
      return element;
    });
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: null, document: documentRef, window })
    );

    await expect(state.copy('copied')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(documentRef.body.querySelector('textarea')).toBeNull();
  });

  it('reports Clipboard API failures without retaining copied state', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('permission denied');
    });
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window, document })
    );

    await expect(state.copy('blocked')).resolves.toBe(false);

    expect(state.text()).toBe('blocked');
    expect(state.copied()).toBe(false);
  });

  it('returns success but resets copied immediately without a window timer', async () => {
    const writeText = vi.fn(async () => {});
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window: null, document: null })
    );

    await expect(state.copy('server')).resolves.toBe(true);
    expect(state.copied()).toBe(false);
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

  it('ignores an outdated rejected write after a newer write succeeds', async () => {
    let rejectFirst!: (reason?: unknown) => void;
    const firstWrite = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockReturnValueOnce(firstWrite)
      .mockResolvedValueOnce();
    const { value: state } = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window, document })
    );

    const firstCopy = state.copy('first');
    await expect(state.copy('second')).resolves.toBe(true);
    rejectFirst(new Error('late failure'));
    await expect(firstCopy).resolves.toBe(false);

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
    await expect(root.value.copy('after dispose')).resolves.toBe(false);
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('does not write after the text signal update disposes the owner', async () => {
    const writeText = vi.fn(async () => {});
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === 'terminal') {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useClipboard({ navigator: { clipboard: { writeText } }, window, document })
      );
      dispose = root.dispose;

      await expect(root.value.copy('terminal')).resolves.toBe(false);
      expect(writeText).not.toHaveBeenCalled();
      expect(root.value.copied()).toBe(false);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not call a backend resolved by a getter that disposes the owner', async () => {
    const writeText = vi.fn(async () => {});
    let dispose = () => {};
    let disposeOnRead = false;
    const navigatorRef = {
      get clipboard() {
        if (disposeOnRead) {
          dispose();
        }
        return { writeText };
      }
    };
    const root = createRoot(() =>
      useClipboard({ navigator: navigatorRef, window: null, document: null })
    );
    dispose = root.dispose;

    disposeOnRead = true;
    await expect(root.value.copy('terminal-backend')).resolves.toBe(false);

    expect(writeText).not.toHaveBeenCalled();
    expect(root.value.text()).toBe('terminal-backend');
    expect(root.value.copied()).toBe(false);
  });

  it('does not invoke a stale backend after its getter starts a newer copy', async () => {
    const writes: string[] = [];
    let copyNested: (value: string) => Promise<boolean> = () => Promise.resolve(false);
    let reenter = false;
    let nestedCopy: Promise<boolean> | undefined;
    const clipboard = {
      get writeText() {
        if (reenter) {
          reenter = false;
          nestedCopy = copyNested('nested-copy');
        }
        return async (value: string) => {
          writes.push(value);
        };
      }
    };
    const controls = createRoot(() =>
      useClipboard({ navigator: { clipboard }, window: null, document: null })
    ).value;
    copyNested = controls.copy;

    reenter = true;
    await expect(controls.copy('outer-copy')).resolves.toBe(false);
    await expect(nestedCopy).resolves.toBe(true);

    expect(writes).toEqual(['nested-copy']);
    expect(controls.text()).toBe('nested-copy');
  });

  it('stops fallback work when reading the body disposes the owner', async () => {
    const execCommand = vi.fn(() => true);
    const documentRef = createClipboardDocument(execCommand);
    const originalBody = documentRef.body;
    const createElement = vi.spyOn(documentRef, 'createElement');
    let dispose = () => {};
    let disposeOnRead = false;
    Object.defineProperty(documentRef, 'body', {
      configurable: true,
      get() {
        if (disposeOnRead) {
          dispose();
        }
        return originalBody;
      }
    });
    const root = createRoot(() =>
      useClipboard({ navigator: null, window: null, document: documentRef })
    );
    dispose = root.dispose;

    disposeOnRead = true;
    await expect(root.value.copy('terminal-fallback')).resolves.toBe(false);

    expect(createElement).not.toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
    expect(root.value.copied()).toBe(false);
  });

  it('does not schedule a reset after the copied signal update disposes the owner', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    let dispose = () => {};
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === true) {
          dispose();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useClipboard({ navigator: { clipboard: { writeText } }, window, document })
      );
      dispose = root.dispose;

      await expect(root.value.copy('copied')).resolves.toBe(true);
      expect(writeText).toHaveBeenCalledOnce();
      expect(root.value.copied()).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('creates and clears copied timers in the injected window realm', async () => {
    const setTimeoutRef = vi.fn(() => 42);
    const clearTimeoutRef = vi.fn();
    const windowRef = {
      setTimeout: setTimeoutRef,
      clearTimeout: clearTimeoutRef
    } as unknown as Window;
    const writeText = vi.fn(async () => {});

    const root = createRoot(() =>
      useClipboard({ navigator: { clipboard: { writeText } }, window: windowRef, document })
    );

    await root.value.copy('first');
    await root.value.copy('second');

    expect(setTimeoutRef).toHaveBeenCalledTimes(2);
    expect(clearTimeoutRef).toHaveBeenCalledTimes(1);
    expect(clearTimeoutRef).toHaveBeenLastCalledWith(42);

    root.dispose();

    expect(clearTimeoutRef).toHaveBeenCalledTimes(2);
    expect(clearTimeoutRef).toHaveBeenLastCalledWith(42);
  });
});
