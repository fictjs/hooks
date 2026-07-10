import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { useFullscreen } from '../../src/browser/useFullscreen';

type FullscreenMockDocument = Document & {
  fullscreenElement: Element | null;
  fullscreenEnabled: boolean;
  documentElement: Element;
  exitFullscreen: () => Promise<void>;
};

type FullscreenMockElement = Element & {
  requestFullscreen: () => Promise<void>;
};

type PrefixedFullscreenMockDocument = Document & {
  documentElement: Element;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

type PrefixedFullscreenMockElement = Element & {
  webkitRequestFullscreen?: () => Promise<void>;
  webkitRequestFullScreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

type PrefixedApi = 'webkit' | 'webkitLegacy' | 'moz' | 'ms';

function createFullscreenMock() {
  const documentTarget = new EventTarget();
  const documentMock = documentTarget as FullscreenMockDocument;

  documentMock.fullscreenElement = null;
  documentMock.fullscreenEnabled = true;
  documentMock.exitFullscreen = vi.fn(async () => {
    documentMock.fullscreenElement = null;
    documentTarget.dispatchEvent(new Event('fullscreenchange'));
  });

  const createElement = (): FullscreenMockElement => {
    const target = new EventTarget();
    const element = target as FullscreenMockElement;
    element.requestFullscreen = vi.fn(async () => {
      documentMock.fullscreenElement = element;
      documentTarget.dispatchEvent(new Event('fullscreenchange'));
    });
    return element;
  };

  const main = createElement();
  const other = createElement();
  Object.defineProperty(documentMock, 'documentElement', {
    configurable: true,
    value: main
  });

  return {
    documentMock,
    main,
    other
  };
}

function createPrefixedFullscreenMock(api: PrefixedApi) {
  const documentMock = new EventTarget() as PrefixedFullscreenMockDocument;
  const element = new EventTarget() as PrefixedFullscreenMockElement;
  Object.defineProperty(documentMock, 'documentElement', {
    configurable: true,
    value: element
  });

  if (api === 'webkit' || api === 'webkitLegacy') {
    documentMock.webkitFullscreenEnabled = true;
    const request = async () => {
      documentMock.webkitFullscreenElement = element;
    };
    if (api === 'webkit') {
      element.webkitRequestFullscreen = vi.fn(request);
    } else {
      element.webkitRequestFullScreen = vi.fn(request);
    }
    documentMock.webkitExitFullscreen = vi.fn(async () => {
      documentMock.webkitFullscreenElement = null;
    });
  } else if (api === 'moz') {
    documentMock.mozFullScreenEnabled = true;
    element.mozRequestFullScreen = vi.fn(async () => {
      documentMock.mozFullScreenElement = element;
    });
    documentMock.mozCancelFullScreen = vi.fn(async () => {
      documentMock.mozFullScreenElement = null;
    });
  } else {
    documentMock.msFullscreenEnabled = true;
    element.msRequestFullscreen = vi.fn(async () => {
      documentMock.msFullscreenElement = element;
    });
    documentMock.msExitFullscreen = vi.fn(async () => {
      documentMock.msFullscreenElement = null;
    });
  }

  return {
    documentMock,
    element
  };
}

describe('useFullscreen', () => {
  it('enters and exits fullscreen for target element', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    expect(state.isSupported()).toBe(true);
    expect(state.isFullscreen()).toBe(false);

    await state.enter();
    expect(state.isFullscreen()).toBe(true);
    expect(main.requestFullscreen).toHaveBeenCalledTimes(1);

    await state.exit();
    expect(state.isFullscreen()).toBe(false);
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('toggles fullscreen state', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    await state.toggle();
    expect(state.isFullscreen()).toBe(true);

    await state.toggle();
    expect(state.isFullscreen()).toBe(false);
  });

  it('uses the document element as the default target', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document
      })
    );

    await expect(state.enter()).resolves.toBe(true);
    expect(main.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(state.isFullscreen()).toBe(true);
  });

  it.each(['webkit', 'webkitLegacy', 'moz', 'ms'] as const)(
    'supports the %s prefixed API',
    async (api) => {
      const { documentMock, element } = createPrefixedFullscreenMock(api);
      const { value: state } = createRoot(() =>
        useFullscreen({
          document: documentMock as unknown as Document,
          target: element
        })
      );

      expect(state.isSupported()).toBe(true);
      await expect(state.enter()).resolves.toBe(true);
      expect(state.isFullscreen()).toBe(true);
      await expect(state.exit()).resolves.toBe(true);
      expect(state.isFullscreen()).toBe(false);
    }
  );

  it('does not report fullscreen when another element is fullscreen', async () => {
    const { documentMock, main, other } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    await other.requestFullscreen();
    expect(state.isFullscreen()).toBe(false);
  });

  it('stops updating when the support signal write disposes the owner', () => {
    const { documentMock, main } = createFullscreenMock();
    documentMock.fullscreenEnabled = false;
    Object.defineProperty(documentMock, 'exitFullscreen', {
      configurable: true,
      value: undefined
    });
    let dispose = () => {};
    let disposedOnSupport = false;
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (value === true && !disposedOnSupport) {
          disposedOnSupport = true;
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
        useFullscreen({ document: documentMock as unknown as Document, target: main })
      );
      dispose = root.dispose;
      documentMock.fullscreenEnabled = true;
      documentMock.fullscreenElement = main;

      documentMock.dispatchEvent(new Event('fullscreenchange'));

      expect(disposedOnSupport).toBe(true);
      expect(root.value.isFullscreen()).toBe(false);
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('exits fullscreen automatically on dispose when autoExit is enabled', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state, dispose } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    await state.enter();
    expect(state.isFullscreen()).toBe(true);

    dispose();
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(state.isFullscreen()).toBe(false);
  });

  it('contains auto-exit failures during disposal', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state, dispose } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    await state.enter();
    documentMock.exitFullscreen = vi.fn(async () => {
      throw new Error('exit denied');
    });

    expect(dispose).not.toThrow();
    await Promise.resolve();

    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(documentMock.fullscreenElement).toBe(main);
    expect(state.isFullscreen()).toBe(false);
  });

  it('skips auto-exit safely when the exit method disappears', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state, dispose } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    await state.enter();
    Object.defineProperty(documentMock, 'exitFullscreen', {
      configurable: true,
      value: undefined
    });

    expect(dispose).not.toThrow();
    await Promise.resolve();

    expect(documentMock.fullscreenElement).toBe(main);
    expect(state.isFullscreen()).toBe(false);
  });

  it('exits a pending fullscreen entry that completes after dispose', async () => {
    const { documentMock, main } = createFullscreenMock();
    let completeRequest = () => {};
    main.requestFullscreen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeRequest = () => {
            documentMock.fullscreenElement = main;
            resolve();
          };
        })
    );
    const root = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    const pendingEnter = root.value.enter();
    root.dispose();
    completeRequest();

    await expect(pendingEnter).resolves.toBe(false);
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(documentMock.fullscreenElement).toBeNull();
    expect(root.value.isFullscreen()).toBe(false);
    await expect(root.value.enter()).resolves.toBe(false);
    expect(main.requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight auto-exit when a pending entry completes after dispose', async () => {
    const { documentMock, main } = createFullscreenMock();
    let completeRequest = () => {};
    let completeExit = () => {};
    main.requestFullscreen = vi.fn(() => {
      documentMock.fullscreenElement = main;
      return new Promise<void>((resolve) => {
        completeRequest = resolve;
      });
    });
    documentMock.exitFullscreen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeExit = () => {
            documentMock.fullscreenElement = null;
            resolve();
          };
        })
    );
    const root = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    const pendingEnter = root.value.enter();
    root.dispose();
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);

    completeRequest();
    await Promise.resolve();
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);

    completeExit();
    await expect(pendingEnter).resolves.toBe(false);
    expect(documentMock.fullscreenElement).toBeNull();
  });

  it('shares a pending public exit with disposal auto-exit', async () => {
    const { documentMock, main } = createFullscreenMock();
    let completeExit = () => {};
    documentMock.fullscreenElement = main;
    documentMock.exitFullscreen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeExit = () => {
            documentMock.fullscreenElement = null;
            resolve();
          };
        })
    );
    const root = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    const pendingExit = root.value.exit();
    root.dispose();

    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);

    completeExit();
    await expect(pendingExit).resolves.toBe(true);
    expect(documentMock.fullscreenElement).toBeNull();
  });

  it('uses the exit method when the browser does not expose a fullscreen element', async () => {
    const successful = createFullscreenMock();
    const successRoot = createRoot(() =>
      useFullscreen({
        document: successful.documentMock as unknown as Document,
        target: successful.main
      })
    );

    await expect(successRoot.value.exit()).resolves.toBe(true);
    expect(successful.documentMock.exitFullscreen).toHaveBeenCalledOnce();
    expect(successRoot.value.isFullscreen()).toBe(false);

    const failing = createFullscreenMock();
    const exitError = new Error('exit failed');
    failing.documentMock.exitFullscreen = vi.fn(async () => {
      throw exitError;
    });
    const failureRoot = createRoot(() =>
      useFullscreen({
        document: failing.documentMock as unknown as Document,
        target: failing.main
      })
    );

    await expect(failureRoot.value.exit()).resolves.toBe(false);
    expect(failing.documentMock.exitFullscreen).toHaveBeenCalledOnce();
    expect(failureRoot.value.isFullscreen()).toBe(false);
  });

  it('leaves a pending fullscreen entry alone when auto-exit is disabled', async () => {
    const { documentMock, main } = createFullscreenMock();
    let completeRequest = () => {};
    main.requestFullscreen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          completeRequest = () => {
            documentMock.fullscreenElement = main;
            resolve();
          };
        })
    );
    const root = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: false
      })
    );

    const pendingEnter = root.value.enter();
    root.dispose();
    completeRequest();

    await expect(pendingEnter).resolves.toBe(false);
    expect(documentMock.exitFullscreen).not.toHaveBeenCalled();
    expect(documentMock.fullscreenElement).toBe(main);
    expect(root.value.isFullscreen()).toBe(false);
  });

  it('contains a pending fullscreen rejection after dispose', async () => {
    const { documentMock, main } = createFullscreenMock();
    let rejectRequest: (error: Error) => void = () => {};
    main.requestFullscreen = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRequest = reject;
        })
    );
    const root = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    const pendingEnter = root.value.enter();
    root.dispose();
    rejectRequest(new Error('request denied'));

    await expect(pendingEnter).resolves.toBe(false);
    expect(root.value.isFullscreen()).toBe(false);
    expect(documentMock.exitFullscreen).not.toHaveBeenCalled();
  });

  it('does not exit another element fullscreen on dispose', async () => {
    const { documentMock, main, other } = createFullscreenMock();
    const { dispose } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    await other.requestFullscreen();
    dispose();

    expect(documentMock.fullscreenElement).toBe(other);
    expect(documentMock.exitFullscreen).not.toHaveBeenCalled();
  });

  it('reports request and exit failures while refreshing state', async () => {
    const { documentMock, main } = createFullscreenMock();
    main.requestFullscreen = vi.fn(async () => {
      throw new Error('request denied');
    });
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    await expect(state.enter()).resolves.toBe(false);
    expect(state.isFullscreen()).toBe(false);

    documentMock.fullscreenElement = main;
    documentMock.dispatchEvent(new Event('fullscreenchange'));
    documentMock.exitFullscreen = vi.fn(async () => {
      throw new Error('exit denied');
    });

    await expect(state.exit()).resolves.toBe(false);
    expect(state.isFullscreen()).toBe(true);
  });

  it('returns false when the target or fullscreen methods are missing', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: nullTargetState } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: null
      })
    );

    expect(nullTargetState.isSupported()).toBe(true);
    await expect(nullTargetState.enter()).resolves.toBe(false);

    Object.defineProperty(main, 'requestFullscreen', {
      configurable: true,
      value: undefined
    });
    const { value: missingRequestState } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );
    await expect(missingRequestState.enter()).resolves.toBe(false);

    Object.defineProperty(documentMock, 'exitFullscreen', {
      configurable: true,
      value: undefined
    });
    await expect(missingRequestState.exit()).resolves.toBe(false);
  });

  it('detects support from an exit method when enabled flags are false', () => {
    const documentMock = new EventTarget() as FullscreenMockDocument;
    const element = new EventTarget() as Element;
    Object.defineProperties(documentMock, {
      documentElement: { configurable: true, value: element },
      fullscreenElement: { configurable: true, value: null, writable: true },
      fullscreenEnabled: { configurable: true, value: false },
      exitFullscreen: { configurable: true, value: vi.fn(async () => {}) }
    });

    const { value: state } = createRoot(() =>
      useFullscreen({ document: documentMock as unknown as Document, target: element })
    );

    expect(state.isSupported()).toBe(true);
  });

  it('returns unsupported state without document', async () => {
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: null
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(await state.enter()).toBe(false);
    expect(await state.exit()).toBe(false);
  });

  it('disposes auto-exit safely without a document', () => {
    const { dispose } = createRoot(() => useFullscreen({ document: null, autoExit: true }));

    expect(dispose).not.toThrow();
  });
});
