import { createRoot } from '@fictjs/runtime';
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
});
