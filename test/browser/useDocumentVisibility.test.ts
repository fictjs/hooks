import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useDocumentVisibility } from '../../src/browser/useDocumentVisibility';

describe('useDocumentVisibility', () => {
  it('reads current visibility state', () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });

    const { value: state } = createRoot(() => useDocumentVisibility());

    expect(state.visibility()).toBe('visible');
    expect(state.hidden()).toBe(false);
  });

  it('updates on visibilitychange', () => {
    let current: DocumentVisibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => current
    });

    const { value: state } = createRoot(() => useDocumentVisibility());

    current = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    expect(state.visibility()).toBe('hidden');
    expect(state.hidden()).toBe(true);
  });

  it('does not update when reading visibility disposes the owner', () => {
    const documentRef = new EventTarget() as Document;
    let dispose = () => {};
    let disposeOnRead = false;
    Object.defineProperty(documentRef, 'visibilityState', {
      configurable: true,
      get() {
        if (disposeOnRead) {
          dispose();
          return 'hidden';
        }
        return 'visible';
      }
    });
    const root = createRoot(() => useDocumentVisibility({ document: documentRef }));
    dispose = root.dispose;

    disposeOnRead = true;
    documentRef.dispatchEvent(new Event('visibilitychange'));

    expect(root.value.visibility()).toBe('visible');
    expect(root.value.hidden()).toBe(false);
  });

  it('uses fallback without document', () => {
    const { value: state } = createRoot(() =>
      useDocumentVisibility({ document: null, initialVisibility: 'hidden' })
    );

    expect(state.visibility()).toBe('hidden');
    expect(state.hidden()).toBe(true);
  });
});
