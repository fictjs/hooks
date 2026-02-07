import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useFullscreen } from '../../src/browser/useFullscreen';

type FullscreenMockDocument = Document & {
  fullscreenElement: Element | null;
  fullscreenEnabled: boolean;
  documentElement: Element;
  exitFullscreen: () => Promise<void>;
};

type FullscreenMockElement = Element & {
  requestFullscreen: () => Promise<void>;
};

function createFullscreenMock() {
  const documentTarget = new EventTarget();
  const documentMock = documentTarget as FullscreenMockDocument;

  documentMock.fullscreenElement = null;
  documentMock.fullscreenEnabled = true;
  documentMock.exitFullscreen = vi.fn(async () => {
    documentMock.fullscreenElement = null;
    documentTarget.dispatchEvent(new Event('fullscreenchange'));
  });

  const createElement = (): FullscreenMockElement => {
    const target = new EventTarget();
    const element = target as FullscreenMockElement;
    element.requestFullscreen = vi.fn(async () => {
      documentMock.fullscreenElement = element;
      documentTarget.dispatchEvent(new Event('fullscreenchange'));
    });
    return element;
  };

  const main = createElement();
  const other = createElement();
  Object.defineProperty(documentMock, 'documentElement', {
    configurable: true,
    value: main
  });

  return {
    documentMock,
    main,
    other
  };
}

describe('useFullscreen', () => {
  it('enters and exits fullscreen for target element', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    expect(state.isSupported()).toBe(true);
    expect(state.isFullscreen()).toBe(false);

    await state.enter();
    expect(state.isFullscreen()).toBe(true);
    expect(main.requestFullscreen).toHaveBeenCalledTimes(1);

    await state.exit();
    expect(state.isFullscreen()).toBe(false);
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('toggles fullscreen state', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    await state.toggle();
    expect(state.isFullscreen()).toBe(true);

    await state.toggle();
    expect(state.isFullscreen()).toBe(false);
  });

  it('does not report fullscreen when another element is fullscreen', async () => {
    const { documentMock, main, other } = createFullscreenMock();
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main
      })
    );

    await other.requestFullscreen();
    expect(state.isFullscreen()).toBe(false);
  });

  it('exits fullscreen automatically on dispose when autoExit is enabled', async () => {
    const { documentMock, main } = createFullscreenMock();
    const { value: state, dispose } = createRoot(() =>
      useFullscreen({
        document: documentMock as unknown as Document,
        target: main,
        autoExit: true
      })
    );

    await state.enter();
    expect(state.isFullscreen()).toBe(true);

    dispose();
    expect(documentMock.exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('returns unsupported state without document', async () => {
    const { value: state } = createRoot(() =>
      useFullscreen({
        document: null
      })
    );

    expect(state.isSupported()).toBe(false);
    expect(await state.enter()).toBe(false);
    expect(await state.exit()).toBe(false);
  });
});
