import { createRoot } from '@fictjs/runtime';
import { describe, expect, it, vi } from 'vitest';
import { useClickOutside } from '../../src/event/useClickOutside';

describe('useClickOutside', () => {
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
});
