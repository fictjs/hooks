import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClickOutside } from '../../src/event/useClickOutside';

function createListenerWindow(): {
  windowRef: Window;
  listeners: Map<string, Set<EventListener>>;
  failures: { add?: string; remove?: string };
} {
  const listeners = new Map<string, Set<EventListener>>();
  const failures: { add?: string; remove?: string } = {};
  const windowRef = {
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    Node: window.Node,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const registered = listeners.get(type) ?? new Set<EventListener>();
      registered.add(listener as EventListener);
      listeners.set(type, registered);
      if (failures.add === type) {
        throw new Error(`${type} add failed`);
      }
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(listener as EventListener);
      if (listeners.get(type)?.size === 0) {
        listeners.delete(type);
      }
      if (failures.remove === type) {
        failures.remove = undefined;
        throw new Error(`${type} remove failed`);
      }
    }
  } as unknown as Window;
  return { windowRef, listeners, failures };
}

describe('useClickOutside', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggers when clicking outside target', () => {
    const target = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(target);
    document.body.appendChild(outside);

    const handler = vi.fn();

    createRoot(() => {
      useClickOutside(target, handler);
    });

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when clicking inside target', () => {
    const target = document.createElement('div');
    const inside = document.createElement('span');
    target.appendChild(inside);
    document.body.appendChild(target);

    const handler = vi.fn();

    createRoot(() => {
      useClickOutside(target, handler);
    });

    inside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    inside.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('does not trigger for target clicks inside shadow dom', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const target = document.createElement('button');
    shadow.appendChild(target);
    document.body.appendChild(host);

    const handler = vi.fn();

    createRoot(() => {
      useClickOutside(target, handler);
    });

    target.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('triggers for keyboard clicks outside target', () => {
    const target = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(target);
    document.body.appendChild(outside);

    const handler = vi.fn();

    createRoot(() => {
      useClickOutside(target, handler);
    });

    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports ignore selectors', () => {
    const target = document.createElement('div');
    const ignore = document.createElement('button');
    ignore.className = 'ignore-me';
    document.body.appendChild(target);
    document.body.appendChild(ignore);

    const handler = vi.fn();

    createRoot(() => {
      useClickOutside(target, handler, { ignore: '.ignore-me' });
    });

    ignore.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    ignore.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it('supports stop and start controls', () => {
    const target = document.createElement('div');
    const outside = document.createElement('button');
    document.body.appendChild(target);
    document.body.appendChild(outside);

    const handler = vi.fn();

    const { value: controls } = createRoot(() => useClickOutside(target, handler));

    expect(controls.active()).toBe(true);
    controls.stop();
    expect(controls.active()).toBe(false);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new Event('click', { bubbles: true }));

    controls.start();
    expect(controls.active()).toBe(true);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rolls back both listeners when start fails partway through', () => {
    const target = document.createElement('div');
    const { windowRef, listeners, failures } = createListenerWindow();
    const controls = createRoot(() =>
      useClickOutside(target, vi.fn(), { window: windowRef, document })
    ).value;
    controls.stop();
    failures.add = 'click';

    expect(() => controls.start()).toThrow('click add failed');

    expect(controls.active()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('continues stopping after one listener cleanup fails', () => {
    const target = document.createElement('div');
    const { windowRef, listeners, failures } = createListenerWindow();
    const controls = createRoot(() =>
      useClickOutside(target, vi.fn(), { window: windowRef, document })
    ).value;
    failures.remove = 'pointerdown';

    expect(() => controls.stop()).toThrow('pointerdown remove failed');

    expect(controls.active()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('clears pending pointer state when stopped and restarted', () => {
    const target = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(target, outside);
    const handler = vi.fn();
    const { value: controls, dispose } = createRoot(() => useClickOutside(target, handler));

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    controls.stop();
    controls.start();
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(handler).not.toHaveBeenCalled();

    dispose();
    target.remove();
    outside.remove();
  });

  it('clears pending pointer state when event handling throws', () => {
    const target = document.createElement('div');
    const outside = document.createElement('button');
    const targetError = new Error('target resolution failed');
    let targetThrows = false;
    const targetAccessor = () => {
      if (targetThrows) {
        throw targetError;
      }
      return target;
    };
    const listeners = new Map<string, EventListener>();
    const windowRef = {
      Event: window.Event,
      MouseEvent: window.MouseEvent,
      Node: window.Node,
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.set(type, listener as EventListener);
      },
      removeEventListener(type: string) {
        listeners.delete(type);
      }
    } as unknown as Window;
    const handlerError = new Error('outside handler failed');
    const handler = vi.fn().mockImplementationOnce(() => {
      throw handlerError;
    });
    const { dispose } = createRoot(() =>
      useClickOutside(targetAccessor, handler, { window: windowRef, document })
    );
    const withTarget = <T extends Event>(event: T): T => {
      Object.defineProperty(event, 'target', { value: outside });
      return event;
    };

    listeners.get('pointerdown')!(withTarget(new Event('pointerdown')));
    expect(() =>
      listeners.get('click')!(withTarget(new MouseEvent('click', { detail: 1 })))
    ).toThrow(handlerError);
    listeners.get('click')!(withTarget(new MouseEvent('click', { detail: 1 })));

    expect(handler).toHaveBeenCalledTimes(1);

    listeners.get('pointerdown')!(withTarget(new Event('pointerdown')));
    targetThrows = true;
    expect(() => listeners.get('pointerdown')!(withTarget(new Event('pointerdown')))).toThrow(
      targetError
    );
    targetThrows = false;
    listeners.get('click')!(withTarget(new MouseEvent('click', { detail: 1 })));

    expect(handler).toHaveBeenCalledTimes(1);

    dispose();
  });

  it('allows outside click handlers to prevent the default action', () => {
    const target = document.createElement('div');
    const outside = document.createElement('a');
    document.body.appendChild(target);
    document.body.appendChild(outside);
    const handler = vi.fn((event: Event) => event.preventDefault());

    createRoot(() => useClickOutside(target, handler));

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const dispatched = outside.dispatchEvent(click);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(click.defaultPrevented).toBe(true);
    expect(dispatched).toBe(false);
  });

  it('uses constructors from the injected DOM realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const realmWindow = iframe.contentWindow as Window & typeof globalThis;
    const realmDocument = iframe.contentDocument!;
    realmDocument.body.innerHTML = '<div id="target"></div><button id="outside"></button>';
    const target = realmDocument.querySelector('#target')!;
    const outside = realmDocument.querySelector('#outside')!;
    const handler = vi.fn();

    vi.stubGlobal('Node', undefined);
    vi.stubGlobal('MouseEvent', undefined);
    vi.stubGlobal('Event', undefined);

    const { value: controls, dispose } = createRoot(() =>
      useClickOutside(target, handler, {
        window: realmWindow,
        document: realmDocument
      })
    );

    outside.dispatchEvent(new realmWindow.Event('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new realmWindow.Event('click', { bubbles: true }));
    outside.dispatchEvent(new realmWindow.MouseEvent('click', { bubbles: true, detail: 0 }));
    controls.trigger();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[2]![0]).toBeInstanceOf(realmWindow.Event);

    dispose();
    iframe.remove();
  });

  it('accepts an adopted outside node from another realm', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const foreignWindow = iframe.contentWindow as Window & typeof globalThis;
    const foreignOutside = iframe.contentDocument!.createElement('button');
    const target = document.createElement('div');
    const adoptedOutside = document.adoptNode(foreignOutside);
    document.body.append(target, adoptedOutside);
    const handler = vi.fn();
    const { dispose } = createRoot(() => useClickOutside(target, handler));

    expect(adoptedOutside).toBeInstanceOf(foreignWindow.Node);
    expect(adoptedOutside).not.toBeInstanceOf(window.Node);

    adoptedOutside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    adoptedOutside.dispatchEvent(new Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledOnce();

    dispose();
    target.remove();
    adoptedOutside.remove();
    iframe.remove();
  });

  it('rejects a spoofed non-node event target', () => {
    const target = document.createElement('div');
    const { windowRef, listeners } = createListenerWindow();
    const handler = vi.fn();
    const { dispose } = createRoot(() =>
      useClickOutside(target, handler, { window: windowRef, document })
    );
    const spoofedTarget = new EventTarget();
    Object.defineProperty(spoofedTarget, 'nodeType', { value: 1 });
    const withTarget = <T extends Event>(event: T): T => {
      Object.defineProperty(event, 'target', { value: spoofedTarget });
      return event;
    };

    for (const listener of listeners.get('pointerdown') ?? []) {
      listener(withTarget(new Event('pointerdown')));
    }
    for (const listener of listeners.get('click') ?? []) {
      listener(withTarget(new MouseEvent('click', { detail: 1 })));
    }

    expect(handler).not.toHaveBeenCalled();
    dispose();
  });

  it('derives the event realm from an injected document', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const realmWindow = iframe.contentWindow as Window & typeof globalThis;
    const realmDocument = iframe.contentDocument!;
    realmDocument.body.innerHTML = '<div id="target"></div><button id="outside"></button>';
    const target = realmDocument.querySelector('#target')!;
    const outside = realmDocument.querySelector('#outside')!;
    const handler = vi.fn();

    const { dispose } = createRoot(() =>
      useClickOutside(target, handler, {
        document: realmDocument
      })
    );

    outside.dispatchEvent(new realmWindow.Event('pointerdown', { bubbles: true }));
    outside.dispatchEvent(new realmWindow.Event('click', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);

    dispose();
    iframe.remove();
  });
});
