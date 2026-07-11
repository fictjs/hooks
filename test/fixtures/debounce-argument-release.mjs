import { createRoot } from '@fictjs/runtime';
import { useDebounceFn } from '../../dist/index.js';

const root = createRoot(() => useDebounceFn(() => {}, 0, { trailing: false }));

function scheduleObject() {
  const value = { uniqueMarker: 'debounce-suppressed-argument' };
  const reference = new WeakRef(value);
  root.value.run(value);
  return reference;
}

const reference = scheduleObject();

await new Promise((resolve) => globalThis.setTimeout(resolve, 10));

for (let attempt = 0; attempt < 10; attempt += 1) {
  globalThis.gc();
  await new Promise((resolve) => globalThis.setImmediate(resolve));
}

if (reference.deref() !== undefined) {
  throw new Error('suppressed debounce argument is still retained');
}

root.dispose();
