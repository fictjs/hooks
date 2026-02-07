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
