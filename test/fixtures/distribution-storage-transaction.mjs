import { loadDistribution } from './load-distribution.mjs';

const { hooks, internal, runtime } = await loadDistribution();
const { useStorage } = hooks;
const { __fictPopContext, __fictPushContext } = internal;
const { createRoot } = runtime;

class MemoryStorage {
  map = new Map();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key) {
    return this.map.get(key) ?? null;
  }
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key) {
    this.map.delete(key);
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

function createCompiledRoot(factory) {
  __fictPushContext();
  try {
    return createRoot(factory);
  } finally {
    __fictPopContext();
  }
}

const eventStorage = new MemoryStorage();
eventStorage.setItem('terminal-event', '0');
const eventWindow = new globalThis.EventTarget();
let eventDispose = () => {};
let disposeOnRead = false;
const eventRoot = createCompiledRoot(() =>
  useStorage('terminal-event', 0, {
    storage: eventStorage,
    window: eventWindow,
    serializer: { read: Number, write: String }
  })
);
eventDispose = eventRoot.dispose;
const storageEvent = new globalThis.Event('storage');
Object.defineProperties(storageEvent, {
  storageArea: {
    get() {
      if (disposeOnRead) eventDispose();
      return eventStorage;
    }
  },
  key: { value: 'terminal-event' },
  newValue: { value: '5' }
});
disposeOnRead = true;
eventWindow.dispatchEvent(storageEvent);
if (eventRoot.value.value() !== 0) {
  throw new Error('built storage listener committed after getter disposal');
}

const serializerStorage = new MemoryStorage();
serializerStorage.setItem('serializer-reentry', '0');
let serializerControls;
let serializerReentry = false;
const serializerRoot = createCompiledRoot(() => {
  serializerControls = useStorage('serializer-reentry', 0, {
    storage: serializerStorage,
    window: new globalThis.EventTarget(),
    serializer: {
      read: Number,
      write(value) {
        if (serializerReentry) {
          serializerReentry = false;
          serializerControls.set(2);
        }
        return String(value);
      }
    }
  });
  return serializerControls;
});
serializerReentry = true;
serializerRoot.value.set(1);
if (serializerRoot.value.value() !== 2 || serializerStorage.getItem('serializer-reentry') !== '2') {
  throw new Error('built storage serializer overwrote a nested set');
}
serializerRoot.dispose();

const removeStorage = new MemoryStorage();
removeStorage.setItem('remove-reentry', '1');
const removeItem = removeStorage.removeItem.bind(removeStorage);
let removeControls;
let removeReentry = false;
removeStorage.removeItem = (key) => {
  removeItem(key);
  if (removeReentry) {
    removeReentry = false;
    removeControls.set(2);
  }
};
const removeRoot = createCompiledRoot(() => {
  removeControls = useStorage('remove-reentry', 0, {
    storage: removeStorage,
    window: new globalThis.EventTarget(),
    serializer: { read: Number, write: String }
  });
  return removeControls;
});
removeReentry = true;
removeRoot.value.remove();
if (removeRoot.value.value() !== 2 || removeStorage.getItem('remove-reentry') !== '2') {
  throw new Error('built storage remove overwrote a nested set');
}
removeRoot.dispose();
