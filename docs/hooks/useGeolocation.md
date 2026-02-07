# useGeolocation

## Purpose

Track geolocation coordinates and errors reactively.

## API

```ts
function useGeolocation(
  options?: PositionOptions & {
    navigator?: Navigator | null;
    immediate?: boolean;
  }
): {
  isSupported: () => boolean;
  coords: () => {
    accuracy: number;
    latitude: number;
    longitude: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  locatedAt: () => number | null;
  error: () => GeolocationPositionError | null;
  active: () => boolean;
  resume: () => void;
  pause: () => void;
};
```

## Notes

- Uses `watchPosition` so updates stay live until paused or root disposed.
- In unsupported environments, `isSupported()` is `false` and no watcher is started.
