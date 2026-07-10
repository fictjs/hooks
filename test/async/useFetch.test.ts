import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useFetch } from '../../src/async/useFetch';

class AdversarialAbortSignal {
  aborted = false;
  reason: unknown;
  addError: unknown;
  removeError: unknown;
  private readonly listeners = new Set<EventListenerOrEventListenerObject>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'abort' || !listener) {
      return;
    }
    this.listeners.add(listener);
    if (this.addError) {
      throw this.addError;
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'abort' || !listener) {
      return;
    }
    if (this.removeError) {
      throw this.removeError;
    }
    this.listeners.delete(listener);
  }

  abort(reason?: unknown): void {
    this.aborted = true;
    this.reason = reason;
    const event = new Event('abort');
    for (const listener of [...this.listeners]) {
      if (typeof listener === 'function') {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
    }
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  asAbortSignal(): AbortSignal {
    return this as unknown as AbortSignal;
  }
}

describe('useFetch', () => {
  it('fetches and parses JSON', async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
    );

    const { value: state } = createRoot(() =>
      useFetch<{ ok: boolean }>('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    await state.execute();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(state.data()).toEqual({ ok: true });
    expect(state.status()).toBe(200);
    expect(state.error()).toBeNull();
  });

  it('supports manual abort', async () => {
    const mockFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return new Response('');
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    const promise = state.execute();
    state.abort();
    await promise;

    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);
  });

  it('settles a manually aborted request without AbortController support', async () => {
    vi.stubGlobal('AbortController', undefined);
    vi.stubGlobal('AbortSignal', undefined);

    try {
      const mockFetch = vi.fn(() => new Promise<Response>(() => {}));
      const { value: state } = createRoot(() =>
        useFetch('https://example.com', {
          fetch: mockFetch as never,
          immediate: false,
          initialData: 'initial'
        })
      );

      const pending = state.execute();
      state.abort();

      await expect(pending).resolves.toBe('initial');
      expect(state.aborted()).toBe(true);
      expect(state.isLoading()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not resolve input for a stale request invalidated during signal resolution', async () => {
    vi.stubGlobal('AbortController', undefined);
    vi.stubGlobal('AbortSignal', undefined);

    let dispose = () => {};
    try {
      const stateRef = { current: undefined as ReturnType<typeof useFetch<string>> | undefined };
      let reentered = false;
      let reentrantRequest: Promise<string | null> | undefined;
      let inputReads = 0;
      const init = Object.defineProperty({} as RequestInit, 'signal', {
        get() {
          if (!reentered) {
            reentered = true;
            reentrantRequest = stateRef.current!.execute();
          }
          return undefined;
        }
      });
      const mockFetch = vi.fn(async () => new Response('latest'));
      const root = createRoot(() =>
        useFetch<string>(
          () => {
            inputReads += 1;
            return 'https://example.com';
          },
          {
            fetch: mockFetch as never,
            immediate: false,
            init
          }
        )
      );
      dispose = root.dispose;
      stateRef.current = root.value;

      const staleRequest = root.value.execute();
      await Promise.all([staleRequest, reentrantRequest!]);

      expect(inputReads).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(root.value.data()).toBe('latest');
    } finally {
      dispose();
      vi.unstubAllGlobals();
    }
  });

  it('does not overwrite a request started by an abort listener', async () => {
    const stateRef = { current: undefined as ReturnType<typeof useFetch<string>> | undefined };
    let reentrantRequest: Promise<string | null> | undefined;
    const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      if (mockFetch.mock.calls.length === 1) {
        init?.signal?.addEventListener(
          'abort',
          () => {
            reentrantRequest = stateRef.current!.execute();
          },
          { once: true }
        );
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(new Response('latest'));
    });

    const root = createRoot(() =>
      useFetch<string>('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );
    const state = root.value;
    stateRef.current = state;

    const firstRequest = state.execute();
    state.abort();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(state.aborted()).toBe(false);
    expect(state.isLoading()).toBe(true);

    await reentrantRequest;
    await firstRequest;

    expect(state.data()).toBe('latest');
    expect(state.aborted()).toBe(false);
    expect(state.isLoading()).toBe(false);
  });

  it('does not overwrite a request started by the aborted signal write', async () => {
    let executeNested = () => Promise.resolve<string | null>(null);
    let nestedRequest: Promise<string | null> | undefined;
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === true) {
          armed = false;
          nestedRequest = executeNested();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };
    const mockFetch = vi
      .fn()
      .mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValueOnce(new Response('latest'));

    try {
      const root = createRoot(() =>
        useFetch<string>('https://example.com', {
          fetch: mockFetch as never,
          immediate: false,
          initialData: 'initial'
        })
      );
      executeNested = root.value.execute;
      const firstRequest = root.value.execute();
      armed = true;

      root.value.abort();

      expect(root.value.aborted()).toBe(false);
      expect(root.value.isLoading()).toBe(true);
      await expect(nestedRequest).resolves.toBe('latest');
      await expect(firstRequest).resolves.toBe('initial');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(root.value.data()).toBe('latest');
      expect(root.value.isLoading()).toBe(false);
      root.dispose();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('respects external abort signals', async () => {
    const controller = new AbortController();
    const mockFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return new Response('');
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    const promise = state.execute({ signal: controller.signal });
    controller.abort();
    await promise;

    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);
  });

  it('handles already-aborted external signals with the fallback signal merger', async () => {
    const originalAnyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined
    });
    const controller = new AbortController();
    const reason = new Error('already aborted');
    controller.abort(reason);
    const mockFetch = vi.fn(async () => new Response('unexpected'));

    try {
      const { value: state } = createRoot(() =>
        useFetch('https://example.com', {
          fetch: mockFetch as never,
          immediate: false,
          initialData: 'initial'
        })
      );

      await expect(state.execute({ signal: controller.signal })).resolves.toBe('initial');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(state.aborted()).toBe(true);
      expect(state.isLoading()).toBe(false);
    } finally {
      if (originalAnyDescriptor) {
        Object.defineProperty(AbortSignal, 'any', originalAnyDescriptor);
      }
    }
  });

  it('treats an external custom abort reason as an abort', async () => {
    const controller = new AbortController();
    const reason = new Error('stop');
    const onError = vi.fn();
    const mockFetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
      return new Response('');
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        onError
      })
    );

    const pending = state.execute({ signal: controller.signal });
    controller.abort(reason);
    await pending;

    expect(state.aborted()).toBe(true);
    expect(state.error()).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('recognizes AbortError objects from another realm', async () => {
    const foreignAbortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const onError = vi.fn();
    const mockFetch = vi.fn(async () => {
      throw foreignAbortError;
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        onError
      })
    );

    await state.execute();

    expect(state.aborted()).toBe(true);
    expect(state.error()).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('cleans merged abort signal listeners after settled fallback requests', async () => {
    const originalAnyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined
    });

    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const mockFetch = vi.fn(async () => new Response('ok'));

    try {
      const { value: state } = createRoot(() =>
        useFetch('https://example.com', {
          fetch: mockFetch as never,
          immediate: false
        })
      );

      await state.execute({ signal: controller.signal });

      expect(addListener).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
      expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    } finally {
      if (originalAnyDescriptor) {
        Object.defineProperty(AbortSignal, 'any', originalAnyDescriptor);
      }
    }
  });

  it('rolls back every fallback listener when registration throws after adding', async () => {
    const originalAnyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined
    });
    const addError = new Error('add failed');
    const firstSignal = new AdversarialAbortSignal();
    const failingSignal = new AdversarialAbortSignal();
    failingSignal.addError = addError;
    const fetcher = vi.fn(async () => new Response('unexpected'));

    try {
      const root = createRoot(() =>
        useFetch('https://example.com', {
          fetch: fetcher as never,
          immediate: false,
          initialData: 'initial',
          init: { signal: firstSignal.asAbortSignal() }
        })
      );

      await expect(root.value.execute({ signal: failingSignal.asAbortSignal() })).resolves.toBe(
        'initial'
      );

      expect(root.value.error()).toBe(addError);
      expect(root.value.isLoading()).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
      expect(firstSignal.listenerCount()).toBe(0);
      expect(failingSignal.listenerCount()).toBe(0);
      root.dispose();
    } finally {
      if (originalAnyDescriptor) {
        Object.defineProperty(AbortSignal, 'any', originalAnyDescriptor);
      }
    }
  });

  it('finishes fallback abort when one listener removal throws', async () => {
    const originalAnyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      value: undefined
    });
    const removeError = new Error('remove failed');
    const failingSignal = new AdversarialAbortSignal();
    const laterSignal = new AdversarialAbortSignal();
    failingSignal.removeError = removeError;
    let mergedSignal: AbortSignal | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      mergedSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });

    try {
      const root = createRoot(() =>
        useFetch('https://example.com', {
          fetch: fetcher as never,
          immediate: false,
          initialData: 'initial',
          init: { signal: failingSignal.asAbortSignal() }
        })
      );
      const pending = root.value.execute({ signal: laterSignal.asAbortSignal() });
      expect(fetcher).toHaveBeenCalledTimes(1);

      expect(() => failingSignal.abort(removeError)).not.toThrow();

      await expect(pending).resolves.toBe('initial');
      expect(mergedSignal?.aborted).toBe(true);
      expect(root.value.aborted()).toBe(true);
      expect(root.value.isLoading()).toBe(false);
      expect(laterSignal.listenerCount()).toBe(0);
      root.dispose();
    } finally {
      if (originalAnyDescriptor) {
        Object.defineProperty(AbortSignal, 'any', originalAnyDescriptor);
      }
    }
  });

  it('does not mark aborted after aborting an already settled request', async () => {
    const mockFetch = vi.fn(async () => new Response('ok'));

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false
      })
    );

    await state.execute();
    expect(state.aborted()).toBe(false);

    state.abort();

    expect(state.aborted()).toBe(false);
    expect(state.isLoading()).toBe(false);
  });

  it('does not let an older parse overwrite a newer request', async () => {
    const parseResolvers = new Map<string, (value: string) => void>();
    let responseId = 0;
    const mockFetch = vi.fn(async () => new Response(String(++responseId)));
    const parse = async (response: Response) => {
      const id = await response.text();
      return new Promise<string>((resolve) => {
        parseResolvers.set(id, resolve);
      });
    };

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        parse
      })
    );

    const first = state.execute();
    while (!parseResolvers.has('1')) {
      await Promise.resolve();
    }
    const second = state.execute();
    while (!parseResolvers.has('2')) {
      await Promise.resolve();
    }

    parseResolvers.get('2')!('new');
    await second;
    parseResolvers.get('1')!('stale');
    await first;

    expect(state.data()).toBe('new');
  });

  it('does not commit parse results after manual abort', async () => {
    let resolveParse: ((value: string) => void) | undefined;
    let parseStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      parseStarted = resolve;
    });
    const mockFetch = vi.fn(async () => new Response('response'));
    const parse = vi.fn(async () => {
      parseStarted?.();
      return new Promise<string>((resolve) => {
        resolveParse = resolve;
      });
    });

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        initialData: 'initial',
        parse
      })
    );

    const pending = state.execute();
    await started;
    state.abort();
    resolveParse!('late');
    await pending;

    expect(state.data()).toBe('initial');
    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);
  });

  it('settles immediately when an external signal aborts a pending parser', async () => {
    const controller = new AbortController();
    let resolveParse: ((value: string) => void) | undefined;
    let parseStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      parseStarted = resolve;
    });
    const parse = vi.fn(async () => {
      parseStarted?.();
      return new Promise<string>((resolve) => {
        resolveParse = resolve;
      });
    });
    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: vi.fn(async () => new Response('response')) as never,
        immediate: false,
        initialData: 'initial',
        parse
      })
    );

    const pending = state.execute({ signal: controller.signal });
    await started;
    controller.abort();

    await expect(pending).resolves.toBe('initial');
    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);

    resolveParse!('late');
    await Promise.resolve();
    expect(state.data()).toBe('initial');
  });

  it('aborts active request on dispose', () => {
    let signal: AbortSignal | undefined;
    const mockFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });

    const { value: state, dispose } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never
      })
    );

    dispose();

    expect(signal?.aborted).toBe(true);
    expect(state.aborted()).toBe(true);
    expect(state.isLoading()).toBe(false);
  });

  it('does not start another request after dispose', async () => {
    const mockFetch = vi.fn(async () => new Response('ok'));
    const { value: state, dispose } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        initialData: 'initial'
      })
    );

    dispose();

    await expect(state.execute()).resolves.toBe('initial');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(state.isLoading()).toBe(false);
  });

  it('does not call the fetcher when the input accessor disposes the root', async () => {
    const mockFetch = vi.fn(async () => new Response('unexpected'));
    let dispose = () => {};
    const root = createRoot(() =>
      useFetch(
        () => {
          dispose();
          return 'https://example.com';
        },
        {
          fetch: mockFetch as never,
          immediate: false,
          initialData: 'initial'
        }
      )
    );
    dispose = root.dispose;

    await expect(root.value.execute()).resolves.toBe('initial');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(root.value.aborted()).toBe(true);
    expect(root.value.isLoading()).toBe(false);
  });

  it('does not call the fetcher when an enumerable init getter disposes the root', async () => {
    const mockFetch = vi.fn(async () => new Response('unexpected'));
    const readLaterProperty = vi.fn(() => 'no-store' as RequestCache);
    let dispose = () => {};
    const init = Object.defineProperty({} as RequestInit, 'headers', {
      configurable: true,
      enumerable: true,
      get() {
        dispose();
        return { accept: 'text/plain' };
      }
    });
    Object.defineProperty(init, 'cache', {
      configurable: true,
      enumerable: true,
      get: readLaterProperty
    });
    const root = createRoot(() =>
      useFetch<string>('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        initialData: 'initial'
      })
    );
    dispose = root.dispose;

    await expect(root.value.execute(init)).resolves.toBe('initial');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(readLaterProperty).not.toHaveBeenCalled();
    expect(root.value.data()).toBe('initial');
    expect(root.value.aborted()).toBe(true);
    expect(root.value.isLoading()).toBe(false);
  });

  it('does not parse when the status write disposes the root', async () => {
    const parse = vi.fn(async () => 'parsed');
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === 201) {
          armed = false;
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
        useFetch<string>('https://example.com', {
          fetch: vi.fn(async () => new Response('response', { status: 201 })) as never,
          immediate: false,
          initialData: 'initial',
          parse
        })
      );
      dispose = root.dispose;
      armed = true;

      await expect(root.value.execute()).resolves.toBe('initial');

      expect(root.value.status()).toBe(201);
      expect(root.value.data()).toBe('initial');
      expect(root.value.aborted()).toBe(true);
      expect(root.value.isLoading()).toBe(false);
      expect(parse).not.toHaveBeenCalled();
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('stores error for failed responses', async () => {
    const onError = vi.fn();
    const mockFetch = vi.fn(async () => new Response('fail', { status: 500 }));

    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: mockFetch as never,
        immediate: false,
        onError
      })
    );

    await state.execute();

    expect((state.error() as Error).message).toContain('500');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not call onError when the error signal update disposes the root', async () => {
    const requestError = new Error('request failed');
    const mockFetch = vi.fn(async () => {
      throw requestError;
    });
    const onError = vi.fn();
    let dispose = () => {};
    let armed = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (armed && value === requestError) {
          armed = false;
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
        useFetch('https://example.com', {
          fetch: mockFetch as never,
          immediate: false,
          initialData: 'initial',
          onError
        })
      );
      dispose = root.dispose;
      armed = true;

      await expect(root.value.execute()).resolves.toBe('initial');

      expect(root.value.error()).toBe(requestError);
      expect(root.value.aborted()).toBe(true);
      expect(root.value.isLoading()).toBe(false);
      expect(onError).not.toHaveBeenCalled();

      await expect(root.value.execute()).resolves.toBe('initial');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not call an onError getter result after the getter disposes the root', async () => {
    const requestError = new Error('request failed');
    const onError = vi.fn();
    let dispose = () => {};
    const options = {
      fetch: vi.fn(async () => {
        throw requestError;
      }) as never,
      immediate: false,
      initialData: 'initial'
    } as {
      fetch: typeof fetch;
      immediate: boolean;
      initialData: string;
      onError?: (error: unknown) => void;
    };
    Object.defineProperty(options, 'onError', {
      configurable: true,
      enumerable: true,
      get() {
        dispose();
        return onError;
      }
    });
    const root = createRoot(() => useFetch<string>('https://example.com', options));
    dispose = root.dispose;

    await expect(root.value.execute()).resolves.toBe('initial');

    expect(root.value.error()).toBe(requestError);
    expect(root.value.aborted()).toBe(true);
    expect(root.value.isLoading()).toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  it('consumes onError failures from immediate execution', async () => {
    const requestError = new Error('request failed');
    const callbackError = new Error('callback failed');
    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        fetch: vi.fn(async () => {
          throw requestError;
        }) as never,
        onError() {
          throw callbackError;
        }
      })
    );

    await vi.waitFor(() => expect(state.isLoading()).toBe(false));

    expect(state.error()).toBe(requestError);
  });

  it('exposes onError failures to explicit execute callers', async () => {
    const requestError = new Error('request failed');
    const callbackError = new Error('callback failed');
    const { value: state } = createRoot(() =>
      useFetch('https://example.com', {
        immediate: false,
        fetch: vi.fn(async () => {
          throw requestError;
        }) as never,
        onError() {
          throw callbackError;
        }
      })
    );

    await expect(state.execute()).rejects.toBe(callbackError);

    expect(state.error()).toBe(requestError);
    expect(state.isLoading()).toBe(false);
  });
});
