import { createRoot } from '@fictjs/runtime';
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

    expect(state.state()).toBe('prompt');
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
