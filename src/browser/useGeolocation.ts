import { onDestroy } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { defaultNavigator } from '../internal/env';

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

  const resume = () => {
    if (!geolocationRef || active()) {
      if (!geolocationRef) {
        isSupported(false);
      }
      return;
    }

    watchId = geolocationRef.watchPosition(
      (position) => {
        coords({
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed
        });
        locatedAt(position.timestamp);
        error(null);
      },
      (nextError) => {
        error(nextError);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
        maximumAge: options.maximumAge
      }
    );

    active(true);
  };

  const pause = () => {
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

  onDestroy(() => {
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
