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

  it.each(['createElement', 'value', 'setAttribute', 'style', 'appendChild', 'select'] as const)(
    'stops fallback work when %s disposes the owner',
    async (phase) => {
      let dispose = () => {};
      let parentNode: { removeChild(node: unknown): unknown } | null = null;
      let textareaValue = '';
      const style = {} as CSSStyleDeclaration;
      Object.defineProperties(style, {
        position: {
          configurable: true,
          get: () => '',
          set() {
            if (phase === 'style') {
              dispose();
            }
          }
        },
        left: {
          configurable: true,
          get: () => '',
          set() {}
        }
      });
      const textarea = {
        get value() {
          return textareaValue;
        },
        set value(next: string) {
          textareaValue = next;
          if (phase === 'value') {
            dispose();
          }
        },
        setAttribute() {
          if (phase === 'setAttribute') {
            dispose();
          }
        },
        style,
        select() {
          if (phase === 'select') {
            dispose();
          }
        },
        remove() {
          parentNode = null;
        },
        get parentNode() {
          return parentNode;
        }
      } as unknown as HTMLTextAreaElement;
      const body = {
        appendChild(node: unknown) {
          parentNode = body;
          if (phase === 'appendChild') {
            dispose();
          }
          return node;
        },
        removeChild(node: unknown) {
          parentNode = null;
          return node;
        }
      };
      const execCommand = vi.fn(() => true);
      const documentRef = {
        body,
        createElement() {
          if (phase === 'createElement') {
            dispose();
          }
          return textarea;
        },
        execCommand
      } as unknown as Document;
      const root = createRoot(() =>
        useClipboard({ navigator: null, document: documentRef, window: null })
      );
      dispose = root.dispose;

      await expect(root.value.copy(`terminal-${phase}`)).resolves.toBe(false);

      expect(execCommand).not.toHaveBeenCalled();
      expect(root.value.copied()).toBe(false);
      expect(parentNode).toBeNull();
    }
  );

  it('resets copied state with a synchronously firing window timer', async () => {
    const clearTimeout = vi.fn();
    const windowRef = {
      setTimeout(callback: () => void) {
        callback();
        return 1;
      },
      clearTimeout
    } as unknown as Window;
    const root = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        document: null,
        window: windowRef
      })
    );

    await expect(root.value.copy('synchronous')).resolves.toBe(true);

    expect(root.value.copied()).toBe(false);
    expect(clearTimeout).not.toHaveBeenCalled();
    root.dispose();
  });

  it('keeps copied state when an injected timer returns no handle', async () => {
    const clearTimeout = vi.fn();
    const windowRef = {
      setTimeout: vi.fn(() => undefined),
      clearTimeout
    } as unknown as Window;
    const root = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        document: null,
        window: windowRef
      })
    );

    await expect(root.value.copy('without-handle')).resolves.toBe(true);

    expect(root.value.copied()).toBe(true);
    root.dispose();
    expect(clearTimeout).not.toHaveBeenCalled();
  });

  it('preserves successful copies when timer registration throws', async () => {
    const windowRef = {
      setTimeout() {
        throw new Error('timer registration failed');
      },
      clearTimeout: vi.fn()
    } as unknown as Window;
    const fallbackDocument = createClipboardDocument(() => true);
    const nativeRoot = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        document: null,
        window: windowRef
      })
    );
    const fallbackRoot = createRoot(() =>
      useClipboard({ navigator: null, document: fallbackDocument, window: windowRef })
    );

    await expect(nativeRoot.value.copy('native')).resolves.toBe(true);
    await expect(fallbackRoot.value.copy('fallback')).resolves.toBe(true);

    expect(nativeRoot.value.copied()).toBe(false);
    expect(fallbackRoot.value.copied()).toBe(false);
    expect(fallbackDocument.body.querySelector('textarea')).toBeNull();
    nativeRoot.dispose();
    fallbackRoot.dispose();
  });

  it('ignores a stale copied timer callback after a newer copy', async () => {
    const callbacks = new Map<number, () => void>();
    let timerId = 0;
    const windowRef = {
      setTimeout(callback: () => void) {
        const id = ++timerId;
        callbacks.set(id, callback);
        return id;
      },
      clearTimeout: vi.fn()
    } as unknown as Window;
    const root = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        document: null,
        window: windowRef
      })
    );
    await root.value.copy('first');
    const staleCallback = callbacks.get(1)!;
    await root.value.copy('second');

    staleCallback();

    expect(root.value.text()).toBe('second');
    expect(root.value.copied()).toBe(true);
    root.dispose();
  });

  it('clears copied state when resolving the Clipboard API throws', async () => {
    vi.useFakeTimers();
    let throwOnRead = false;
    const clipboard = { writeText: vi.fn(async () => {}) };
    const navigatorRef = {
      get clipboard() {
        if (throwOnRead) {
          throw new Error('clipboard unavailable');
        }
        return clipboard;
      }
    };
    const root = createRoot(() => useClipboard({ navigator: navigatorRef, document, window }));
    await root.value.copy('first');
    expect(root.value.copied()).toBe(true);
    throwOnRead = true;

    await expect(root.value.copy('second')).resolves.toBe(false);

    expect(root.value.text()).toBe('second');
    expect(root.value.copied()).toBe(false);
    root.dispose();
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

  it('rolls back a timer when registration disposes the owner', async () => {
    const activeTimers = new Set<number>();
    let timerId = 0;
    let dispose = () => {};
    let disposeOnSet = false;
    const windowRef = {
      setTimeout() {
        const id = ++timerId;
        activeTimers.add(id);
        if (disposeOnSet) {
          disposeOnSet = false;
          dispose();
        }
        return id;
      },
      clearTimeout(id: number) {
        activeTimers.delete(id);
      }
    } as unknown as Window;
    const root = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        window: windowRef,
        document: null
      })
    );
    dispose = root.dispose;

    disposeOnSet = true;
    await expect(root.value.copy('terminal-timer')).resolves.toBe(true);

    expect(activeTimers.size).toBe(0);
    await expect(root.value.copy('after-dispose')).resolves.toBe(false);
  });

  it('does not register a replacement timer when clearing disposes the owner', async () => {
    const activeTimers = new Set<number>();
    let timerId = 0;
    let dispose = () => {};
    let disposeOnClear = false;
    const windowRef = {
      setTimeout() {
        const id = ++timerId;
        activeTimers.add(id);
        return id;
      },
      clearTimeout(id: number) {
        activeTimers.delete(id);
        if (disposeOnClear) {
          disposeOnClear = false;
          dispose();
        }
      }
    } as unknown as Window;
    const root = createRoot(() =>
      useClipboard({
        navigator: { clipboard: { writeText: async () => {} } },
        window: windowRef,
        document: null
      })
    );
    dispose = root.dispose;

    await root.value.copy('first');
    expect(activeTimers.size).toBe(1);
    disposeOnClear = true;
    await expect(root.value.copy('second')).resolves.toBe(true);

    expect(activeTimers.size).toBe(0);
    await expect(root.value.copy('after-dispose')).resolves.toBe(false);
  });

  it('preserves a timer created reentrantly from the copied reset signal', async () => {
    const timers = new Map<number, () => void>();
    let timerId = 0;
    const windowRef = {
      setTimeout(callback: () => void) {
        const id = ++timerId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      }
    } as unknown as Window;
    let copyNested = () => Promise.resolve(false);
    let nestedCopy: Promise<boolean> | undefined;
    let resetReentry = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (resetReentry && value === false) {
          resetReentry = false;
          nestedCopy = copyNested();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      const root = createRoot(() =>
        useClipboard({
          navigator: { clipboard: { writeText: async () => {} } },
          window: windowRef,
          document: null
        })
      );
      copyNested = () => root.value.copy('nested-reset');
      await root.value.copy('first');

      const [firstTimerId, firstTimer] = [...timers.entries()][0]!;
      timers.delete(firstTimerId);
      resetReentry = true;
      firstTimer();
      await expect(nestedCopy).resolves.toBe(true);

      expect(timers.size).toBe(1);
      expect(root.value.copied()).toBe(true);
      root.dispose();
      expect(timers.size).toBe(0);
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
