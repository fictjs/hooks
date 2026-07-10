import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useGeolocation } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

const getterNames = [
  'coords',
  'accuracy',
  'latitude',
  'longitude',
  'altitude',
  'altitudeAccuracy',
  'heading',
  'speed',
  'timestamp'
];

for (const getterName of getterNames) {
  let successCallback;
  let clearWatchCalls = 0;
  const geolocation = {
    watchPosition(success) {
      successCallback = success;
      return 1;
    },
    clearWatch() {
      clearWatchCalls += 1;
    }
  };
  const root = createCompiledRoot(() => useGeolocation({ navigator: { geolocation } }));
  const previousCoords = root.value.coords();
  const invalidate = getterName === 'timestamp' ? root.dispose : root.value.pause;
  const coords = new Proxy(
    {
      accuracy: 1,
      latitude: 35,
      longitude: 120,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return {};
      }
    },
    {
      get(target, property, receiver) {
        if (property === getterName) {
          invalidate();
        }
        return Reflect.get(target, property, receiver);
      }
    }
  );
  const position = new Proxy(
    {
      coords,
      timestamp: 1234,
      toJSON() {
        return {};
      }
    },
    {
      get(target, property, receiver) {
        if (property === getterName) {
          invalidate();
        }
        return Reflect.get(target, property, receiver);
      }
    }
  );

  successCallback(position);

  if (
    root.value.coords() !== previousCoords ||
    root.value.locatedAt() !== null ||
    root.value.active() ||
    clearWatchCalls !== 1
  ) {
    throw new Error(`built useGeolocation committed after the ${getterName} getter lost ownership`);
  }

  root.dispose();
}
