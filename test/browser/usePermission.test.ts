import { createRoot } from '@fictjs/runtime';
import type { FictDevtoolsHook } from '@fictjs/runtime/advanced';
import { createSignal } from '@fictjs/runtime/advanced';
import { describe, expect, it, vi } from 'vitest';
import { usePermission } from '../../src/browser/usePermission';

class MockPermissionStatus extends EventTarget implements PermissionStatus {
  state: PermissionState;
  name: PermissionName;
  onchange: ((this: PermissionStatus, ev: Event) => unknown) | null = null;

  constructor(name: PermissionName, state: PermissionState) {
    super();
    this.name = name;
    this.state = state;
  }

  update(nextState: PermissionState) {
    this.state = nextState;
    this.dispatchEvent(new Event('change'));
  }
}

class GetterPermissionDescriptor implements PermissionDescriptor {
  readonly #name: PermissionName;
  readonly #sysex: boolean;

  constructor(name: PermissionName, sysex = false) {
    this.#name = name;
    this.#sysex = sysex;
  }

  get name(): PermissionName {
    return this.#name;
  }

  get sysex(): boolean {
    return this.#sysex;
  }
}

describe('usePermission', () => {
  it('returns unsupported state without permissions api', async () => {
    const { value: state } = createRoot(() =>
      usePermission('notifications', {
        navigator: null
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(await state.query()).toBeNull();
  });

  it('queries permission and syncs state on change event', async () => {
    const status = new MockPermissionStatus('notifications', 'granted');
    const navigatorRef = {
      permissions: {
        query: vi.fn(async () => status)
      }
    } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      usePermission('notifications', {
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    expect(state.state()).toBe('prompt');
    await state.query();
    expect(state.state()).toBe('granted');

    status.update('denied');
    expect(state.state()).toBe('denied');
  });

  it('supports immediate query execution', async () => {
    const status = new MockPermissionStatus('geolocation', 'granted');
    const navigatorRef = {
      permissions: {
        query: vi.fn(async () => status)
      }
    } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      usePermission({ name: 'geolocation' }, { navigator: navigatorRef as never })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(state.state()).toBe('granted');
  });

  it('keeps latest permission state when queries resolve out of order', async () => {
    const pending = new Map<string, (status: PermissionStatus) => void>();
    const navigatorRef = {
      permissions: {
        query: vi.fn((input: PermissionDescriptor) => {
          return new Promise<PermissionStatus>((resolve) => {
            pending.set(String(input.name), resolve);
          });
        })
      }
    } as unknown as Navigator;

    const permission = createSignal<PermissionDescriptor | string>('camera');
    const { value: state } = createRoot(() =>
      usePermission(() => permission(), {
        navigator: navigatorRef as never
      })
    );

    await Promise.resolve();
    permission('geolocation');
    await Promise.resolve();

    pending.get('geolocation')!(new MockPermissionStatus('geolocation', 'granted'));
    await Promise.resolve();
    expect(state.state()).toBe('granted');

    pending.get('camera')!(new MockPermissionStatus('camera', 'denied'));
    await Promise.resolve();
    expect(state.state()).toBe('granted');
  });

  it('invalidates a manual query when the permission source changes', async () => {
    let resolveQuery: ((status: PermissionStatus) => void) | undefined;
    const staleStatus = new MockPermissionStatus('camera', 'denied');
    const addEventListener = vi.spyOn(staleStatus, 'addEventListener');
    const navigatorRef = {
      permissions: {
        query: vi.fn(
          () =>
            new Promise<PermissionStatus>((resolve) => {
              resolveQuery = resolve;
            })
        )
      }
    } as unknown as Navigator;
    const permission = createSignal<PermissionDescriptor | string>('camera');

    const { value: state } = createRoot(() =>
      usePermission(() => permission(), {
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    const pending = state.query();
    permission('microphone');
    await Promise.resolve();
    resolveQuery!(staleStatus);

    expect(await pending).toBeNull();
    expect(state.state()).toBe('prompt');
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('queries the current permission when the source changes in the same tick', async () => {
    const status = new MockPermissionStatus('microphone' as PermissionName, 'granted');
    const query = vi.fn(async () => status);
    const navigatorRef = { permissions: { query } } as unknown as Navigator;
    const permission = createSignal<PermissionDescriptor | string>('camera');
    const { value: state } = createRoot(() =>
      usePermission(() => permission(), {
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    permission('microphone');
    const result = state.query();

    expect(query).toHaveBeenCalledWith({ name: 'microphone' });
    await expect(result).resolves.toBe(status);
    expect(state.state()).toBe('granted');
  });

  it('reacts to permission names exposed through inherited getters', async () => {
    const query = vi.fn(async (input: PermissionDescriptor) => {
      return new MockPermissionStatus(input.name, 'granted');
    });
    const permission = createSignal<PermissionDescriptor>(new GetterPermissionDescriptor('camera'));
    createRoot(() =>
      usePermission(() => permission(), {
        navigator: { permissions: { query } }
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(query).toHaveBeenCalledTimes(1);

    const microphone = new GetterPermissionDescriptor('microphone');
    permission(microphone);
    await Promise.resolve();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(microphone);
  });

  it('reacts to standard descriptor options exposed through inherited getters', async () => {
    const query = vi.fn(async (input: PermissionDescriptor) => {
      return new MockPermissionStatus(input.name, 'granted');
    });
    const permission = createSignal<PermissionDescriptor>(
      new GetterPermissionDescriptor('midi', false)
    );
    createRoot(() =>
      usePermission(() => permission(), {
        navigator: { permissions: { query } }
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(query).toHaveBeenCalledTimes(1);

    const midiWithSysex = new GetterPermissionDescriptor('midi', true);
    permission(midiWithSysex);
    await Promise.resolve();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(midiWithSysex);
  });

  it('still queries an immediate source change after a stale status event', async () => {
    const cameraStatus = new MockPermissionStatus('camera', 'granted');
    const microphoneStatus = new MockPermissionStatus('microphone' as PermissionName, 'denied');
    const query = vi.fn(async (input: PermissionDescriptor) => {
      return input.name === 'camera' ? cameraStatus : microphoneStatus;
    });
    const permission = createSignal<PermissionDescriptor | string>('camera');
    const { value: state } = createRoot(() =>
      usePermission(() => permission(), {
        navigator: { permissions: { query } }
      })
    );

    await Promise.resolve();
    await Promise.resolve();
    expect(state.state()).toBe('granted');

    permission('microphone');
    cameraStatus.update('denied');
    await Promise.resolve();
    await Promise.resolve();

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith({ name: 'microphone' });
    expect(state.state()).toBe('denied');
  });

  it('resets stale state when a non-immediate permission source changes', async () => {
    const cameraStatus = new MockPermissionStatus('camera', 'granted');
    const query = vi.fn(async () => cameraStatus);
    const permission = createSignal<PermissionDescriptor | string>('camera');
    const { value: state } = createRoot(() =>
      usePermission(() => permission(), {
        navigator: { permissions: { query } },
        immediate: false
      })
    );

    await state.query();
    expect(state.state()).toBe('granted');

    permission('microphone');
    cameraStatus.update('denied');

    expect(state.state()).toBe('granted');
    await Promise.resolve();
    expect(state.state()).toBe('prompt');
    expect(query).toHaveBeenCalledTimes(1);

    cameraStatus.update('granted');
    expect(state.state()).toBe('prompt');
  });

  it('cleans up change listener on dispose', async () => {
    const status = new MockPermissionStatus('camera', 'granted');
    const navigatorRef = {
      permissions: {
        query: vi.fn(async () => status)
      }
    } as unknown as Navigator;

    const { value: state, dispose } = createRoot(() =>
      usePermission('camera', {
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    await state.query();
    expect(state.state()).toBe('granted');

    dispose();
    status.update('denied');
    expect(state.state()).toBe('granted');
  });

  it('does not update state when the permission accessor disposes the owner', async () => {
    const status = new MockPermissionStatus('camera', 'granted');
    let dispose = () => {};
    let disposeOnRead = false;
    const root = createRoot(() =>
      usePermission(
        () => {
          if (disposeOnRead) {
            dispose();
          }
          return 'camera';
        },
        {
          navigator: { permissions: { query: vi.fn(async () => status) } },
          immediate: false
        }
      )
    );
    dispose = root.dispose;

    await root.value.query();
    expect(root.value.state()).toBe('granted');

    disposeOnRead = true;
    status.update('denied');

    expect(root.value.state()).toBe('granted');
    await expect(root.value.query()).resolves.toBeNull();
  });

  it('does not bind listener when query resolves after dispose', async () => {
    let resolveQuery: ((status: PermissionStatus) => void) | undefined;
    const status = new MockPermissionStatus('camera', 'granted');
    const addEventListener = vi.spyOn(status, 'addEventListener');
    const navigatorRef = {
      permissions: {
        query: vi.fn(
          () =>
            new Promise<PermissionStatus>((resolve) => {
              resolveQuery = resolve;
            })
        )
      }
    } as unknown as Navigator;

    const { dispose } = createRoot(() =>
      usePermission('camera', {
        navigator: navigatorRef as never
      })
    );

    dispose();
    resolveQuery!(status);
    await Promise.resolve();

    expect(addEventListener).toHaveBeenCalledTimes(0);
  });

  it('does not bind a listener when reading the status disposes the owner', async () => {
    const status = new MockPermissionStatus('camera', 'granted');
    const addEventListener = vi.spyOn(status, 'addEventListener');
    let dispose = () => {};
    Object.defineProperty(status, 'state', {
      configurable: true,
      get: () => {
        dispose();
        return 'granted';
      }
    });
    const root = createRoot(() =>
      usePermission('camera', {
        navigator: { permissions: { query: vi.fn(async () => status) } },
        immediate: false
      })
    );
    dispose = root.dispose;

    await expect(root.value.query()).resolves.toBe(status);

    expect(root.value.state()).toBe('granted');
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it('rolls back a listener registered after addEventListener disposes the owner', async () => {
    const listeners = new Set<EventListener>();
    let dispose = () => {};
    const status = {
      name: 'camera',
      state: 'granted',
      addEventListener(_type: string, listener: EventListener) {
        dispose();
        listeners.add(listener);
      },
      removeEventListener(_type: string, listener: EventListener) {
        listeners.delete(listener);
      }
    } as unknown as PermissionStatus;
    const root = createRoot(() =>
      usePermission('camera', {
        navigator: { permissions: { query: vi.fn(async () => status) } },
        immediate: false
      })
    );
    dispose = root.dispose;

    await expect(root.value.query()).resolves.toBe(status);

    expect(listeners.size).toBe(0);
    expect(root.value.state()).toBe('granted');
  });

  it('best-effort rolls back a listener when registration throws', async () => {
    const registrationError = new Error('permission listener registration failed');
    const rollbackError = new Error('permission listener rollback failed');
    const listeners = new Set<EventListener>();
    const removeEventListener = vi.fn((_type: string, listener: EventListener) => {
      listeners.delete(listener);
      throw rollbackError;
    });
    const status = {
      name: 'camera',
      state: 'granted',
      addEventListener(_type: string, listener: EventListener) {
        listeners.add(listener);
        throw registrationError;
      },
      removeEventListener
    } as unknown as PermissionStatus;
    const state = createRoot(() =>
      usePermission('camera', {
        navigator: { permissions: { query: vi.fn(async () => status) } },
        immediate: false
      })
    ).value;

    await expect(state.query()).resolves.toBeNull();

    expect(removeEventListener).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
    expect(state.state()).toBe('prompt');
  });

  it('does not bind a status superseded from its state signal notification', async () => {
    const firstStatus = new MockPermissionStatus('camera', 'granted');
    const secondStatus = new MockPermissionStatus('camera', 'denied');
    const firstAddListener = vi.spyOn(firstStatus, 'addEventListener');
    let resolveSecond: (status: PermissionStatus) => void = () => {};
    const secondQuery = new Promise<PermissionStatus>((resolve) => {
      resolveSecond = resolve;
    });
    const query = vi
      .fn<() => Promise<PermissionStatus>>()
      .mockResolvedValueOnce(firstStatus)
      .mockReturnValueOnce(secondQuery);
    const globalWithHook = globalThis as typeof globalThis & {
      __FICT_DEVTOOLS_HOOK__?: FictDevtoolsHook;
    };
    const previousHook = globalWithHook.__FICT_DEVTOOLS_HOOK__;
    let state: ReturnType<typeof usePermission>;
    let nested: Promise<PermissionStatus | null> | undefined;
    let reenter = false;
    globalWithHook.__FICT_DEVTOOLS_HOOK__ = {
      registerSignal: vi.fn(),
      updateSignal: (_id, value) => {
        if (reenter && value === 'granted') {
          reenter = false;
          nested = state.query();
        }
      },
      registerComputed: vi.fn(),
      updateComputed: vi.fn(),
      registerEffect: vi.fn(),
      effectRun: vi.fn()
    };

    try {
      state = createRoot(() =>
        usePermission('camera', {
          navigator: { permissions: { query } },
          immediate: false
        })
      ).value;
      reenter = true;

      await expect(state.query()).resolves.toBe(firstStatus);
      firstStatus.update('denied');

      expect(firstAddListener).not.toHaveBeenCalled();
      expect(state.state()).toBe('granted');

      resolveSecond(secondStatus);
      await expect(nested).resolves.toBe(secondStatus);
      expect(state.state()).toBe('denied');
    } finally {
      globalWithHook.__FICT_DEVTOOLS_HOOK__ = previousHook;
    }
  });

  it('does not query or bind a status after dispose', async () => {
    const status = new MockPermissionStatus('camera', 'granted');
    const addEventListener = vi.spyOn(status, 'addEventListener');
    const query = vi.fn(async () => status);
    const root = createRoot(() =>
      usePermission('camera', {
        navigator: { permissions: { query } },
        immediate: false
      })
    );

    root.dispose();

    await expect(root.value.query()).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(root.value.state()).toBe('prompt');
  });
});
