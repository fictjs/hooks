import { createSignal } from '@fictjs/runtime/advanced';
import { defaultNavigator } from '../internal/env';
import { tryOnDestroy } from '../internal/lifecycle';

interface GeolocationNavigator {
  geolocation?: {
    watchPosition: (
      success: PositionCallback,
      error?: PositionErrorCallback,
      options?: PositionOptions
    ) => number;
    clearWatch: (watchId: number) => void;
  };
}

export interface GeolocationCoordsState {
  accuracy: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export interface UseGeolocationOptions extends PositionOptions {
  navigator?: GeolocationNavigator | null;
  immediate?: boolean;
}

export interface UseGeolocationReturn {
  isSupported: () => boolean;
  coords: () => GeolocationCoordsState;
  locatedAt: () => number | null;
  error: () => GeolocationPositionError | null;
  active: () => boolean;
  resume: () => void;
  pause: () => void;
}

function createInitialCoords(): GeolocationCoordsState {
  return {
    accuracy: 0,
    latitude: Number.POSITIVE_INFINITY,
    longitude: Number.POSITIVE_INFINITY,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  };
}

/**
 * Reactive Geolocation API wrapper.
 *
 * @fictReturn { isSupported: 'signal', coords: 'signal', locatedAt: 'signal', error: 'signal', active: 'signal' }
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const navigatorRef =
    options.navigator === undefined
      ? (defaultNavigator as GeolocationNavigator | undefined)
      : options.navigator;
  const geolocationRef = navigatorRef?.geolocation;

  const isSupported = createSignal(!!geolocationRef);
  const coords = createSignal<GeolocationCoordsState>(createInitialCoords());
  const locatedAt = createSignal<number | null>(null);
  const error = createSignal<GeolocationPositionError | null>(null);
  const active = createSignal(false);

  let watchId: number | null = null;
  let generation = 0;
  let disposed = false;

  const resume = () => {
    if (disposed || !geolocationRef || active()) {
      if (!geolocationRef) {
        isSupported(false);
      }
      return;
    }

    const currentGeneration = ++generation;
    const nextWatchId = geolocationRef.watchPosition(
      (position) => {
        const ownsSnapshot = () => !disposed && currentGeneration === generation;
        if (!ownsSnapshot()) {
          return;
        }

        const positionCoords = position.coords;
        if (!ownsSnapshot()) {
          return;
        }
        const accuracy = positionCoords.accuracy;
        if (!ownsSnapshot()) {
          return;
        }
        const latitude = positionCoords.latitude;
        if (!ownsSnapshot()) {
          return;
        }
        const longitude = positionCoords.longitude;
        if (!ownsSnapshot()) {
          return;
        }
        const altitude = positionCoords.altitude;
        if (!ownsSnapshot()) {
          return;
        }
        const altitudeAccuracy = positionCoords.altitudeAccuracy;
        if (!ownsSnapshot()) {
          return;
        }
        const heading = positionCoords.heading;
        if (!ownsSnapshot()) {
          return;
        }
        const speed = positionCoords.speed;
        if (!ownsSnapshot()) {
          return;
        }
        const timestamp = position.timestamp;
        if (!ownsSnapshot()) {
          return;
        }

        coords({
          accuracy,
          latitude,
          longitude,
          altitude,
          altitudeAccuracy,
          heading,
          speed
        });
        if (!ownsSnapshot()) {
          return;
        }
        locatedAt(timestamp);
        if (!ownsSnapshot()) {
          return;
        }
        error(null);
      },
      (nextError) => {
        if (currentGeneration !== generation) {
          return;
        }
        error(nextError);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge
      }
    );

    if (disposed || currentGeneration !== generation) {
      active(false);
      geolocationRef.clearWatch(nextWatchId);
      return;
    }

    watchId = nextWatchId;
    active(true);
  };

  const pause = () => {
    generation += 1;
    if (!geolocationRef || watchId == null) {
      active(false);
      return;
    }
    geolocationRef.clearWatch(watchId);
    watchId = null;
    active(false);
  };

  if (options.immediate ?? true) {
    resume();
  }

  tryOnDestroy(() => {
    disposed = true;
    pause();
  });

  return {
    isSupported,
    coords,
    locatedAt,
    error,
    active,
    resume,
    pause
  };
}
