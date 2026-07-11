import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../../src/browser/useGeolocation';

class MockGeolocation {
  watchPosition = vi.fn(
    (
      success: PositionCallback,
      error?: PositionErrorCallback,
      options?: PositionOptions
    ): number => {
      this.lastSuccess = success;
      this.lastError = error;
      this.successCallbacks.push(success);
      if (error) {
        this.errorCallbacks.push(error);
      }
      this.lastOptions = options;
      const nextId = ++this.idSeed;
      this.activeIds.add(nextId);
      return nextId;
    }
  );

  clearWatch = vi.fn((id: number) => {
    this.activeIds.delete(id);
  });

  private idSeed = 0;
  private activeIds = new Set<number>();
  private lastSuccess?: PositionCallback;
  private lastError?: PositionErrorCallback;
  successCallbacks: PositionCallback[] = [];
  errorCallbacks: PositionErrorCallback[] = [];
  lastOptions?: PositionOptions;

  emitSuccess(partial?: Partial<GeolocationCoordinates>, timestamp = Date.now()) {
    const callback = this.lastSuccess;
    if (!callback) {
      return;
    }

    callback({
      coords: {
        accuracy: partial?.accuracy ?? 1,
        latitude: partial?.latitude ?? 10,
        longitude: partial?.longitude ?? 20,
        altitude: partial?.altitude ?? null,
        altitudeAccuracy: partial?.altitudeAccuracy ?? null,
        heading: partial?.heading ?? null,
        speed: partial?.speed ?? null,
        toJSON() {
          return {};
        }
      },
      timestamp,
      toJSON() {
        return {};
      }
    });
  }

  emitError(code = 1, message = 'denied') {
    const callback = this.lastError;
    if (!callback) {
      return;
    }

    callback({
      code,
      message,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });
  }
}

describe('useGeolocation', () => {
  it('starts watcher immediately and updates coords', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );

    expect(state.isSupported()).toBe(true);
    expect(state.active()).toBe(true);
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);

    geolocation.emitSuccess({ latitude: 35.1, longitude: 120.9 }, 1234);
    expect(state.coords().latitude).toBe(35.1);
    expect(state.coords().longitude).toBe(120.9);
    expect(state.locatedAt()).toBe(1234);
    expect(state.error()).toBeNull();
  });

  it('supports pause and resume controls', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );

    state.pause();
    expect(state.active()).toBe(false);
    expect(geolocation.clearWatch).toHaveBeenCalledTimes(1);

    state.resume();
    expect(state.active()).toBe(true);
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
  });

  it('ignores queued callbacks from paused and replaced watchers', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );
    const firstSuccess = geolocation.successCallbacks[0]!;
    const firstError = geolocation.errorCallbacks[0]!;

    state.pause();
    geolocation.emitSuccess({ latitude: 1 }, 100);
    firstSuccess({
      coords: {
        accuracy: 1,
        latitude: 2,
        longitude: 3,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({})
      },
      timestamp: 200,
      toJSON: () => ({})
    });
    firstError({
      code: 1,
      message: 'stale',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    });

    expect(state.locatedAt()).toBeNull();
    expect(state.error()).toBeNull();

    state.resume();
    geolocation.emitSuccess({ latitude: 30 }, 300);
    expect(state.coords().latitude).toBe(30);

    firstSuccess({
      coords: {
        accuracy: 1,
        latitude: 4,
        longitude: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({})
      },
      timestamp: 400,
      toJSON: () => ({})
    });
    expect(state.coords().latitude).toBe(30);
    expect(state.locatedAt()).toBe(300);
  });

  it('captures geolocation errors', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );

    geolocation.emitError(2, 'unavailable');
    expect(state.error()?.code).toBe(2);
    expect(state.error()?.message).toBe('unavailable');
  });

  it('does not start immediately when immediate is false', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    expect(state.active()).toBe(false);
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(0);
  });

  it('clears watcher on dispose', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { dispose } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );

    dispose();
    expect(geolocation.clearWatch).toHaveBeenCalledTimes(1);
  });

  it('does not create another watcher after dispose', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;
    const root = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never,
        immediate: false
      })
    );

    root.dispose();
    root.value.resume();

    expect(geolocation.watchPosition).not.toHaveBeenCalled();
    expect(root.value.active()).toBe(false);
  });

  it('clears a watcher returned after watch setup disposes the owner', () => {
    let disposeOwner = () => {};
    const geolocation = {
      watchPosition: vi.fn(() => {
        disposeOwner();
        return 7;
      }),
      clearWatch: vi.fn()
    };
    const root = createRoot(() =>
      useGeolocation({
        navigator: { geolocation },
        immediate: false
      })
    );
    disposeOwner = root.dispose;

    root.value.resume();

    expect(geolocation.clearWatch).toHaveBeenCalledOnce();
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
    expect(root.value.active()).toBe(false);
    root.value.resume();
    expect(geolocation.watchPosition).toHaveBeenCalledOnce();
  });

  it('preserves a watcher resumed during stale watcher cleanup', () => {
    let pauseDuringSetup = () => {};
    let resumeDuringClear = () => {};
    let nextWatchId = 0;
    const liveWatchIds = new Set<number>();
    const geolocation = {
      watchPosition: vi.fn(() => {
        const watchId = ++nextWatchId;
        if (watchId === 1) {
          pauseDuringSetup();
        }
        liveWatchIds.add(watchId);
        return watchId;
      }),
      clearWatch: vi.fn((watchId: number) => {
        liveWatchIds.delete(watchId);
        if (watchId === 1) {
          resumeDuringClear();
        }
      })
    };
    const root = createRoot(() =>
      useGeolocation({
        navigator: { geolocation },
        immediate: false
      })
    );
    pauseDuringSetup = root.value.pause;
    resumeDuringClear = root.value.resume;

    root.value.resume();

    expect(geolocation.watchPosition).toHaveBeenCalledTimes(2);
    expect(geolocation.clearWatch).toHaveBeenCalledWith(1);
    expect([...liveWatchIds]).toEqual([2]);
    expect(root.value.active()).toBe(true);

    root.value.pause();
    expect([...liveWatchIds]).toEqual([]);
    expect(root.value.active()).toBe(false);
  });

  it('ignores queued watcher callbacks after dispose', () => {
    const geolocation = new MockGeolocation();
    const navigatorRef = { geolocation } as unknown as Navigator;

    const { value: state, dispose } = createRoot(() =>
      useGeolocation({
        navigator: navigatorRef as never
      })
    );

    dispose();
    geolocation.emitSuccess({ latitude: 99 }, 999);
    geolocation.emitError(2, 'late');

    expect(state.coords().latitude).toBe(Number.POSITIVE_INFINITY);
    expect(state.locatedAt()).toBeNull();
    expect(state.error()).toBeNull();
  });

  it('returns unsupported state when geolocation api is missing', () => {
    const { value: state } = createRoot(() =>
      useGeolocation({
        navigator: null
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(state.active()).toBe(false);
    state.resume();
    expect(state.active()).toBe(false);
  });
});
