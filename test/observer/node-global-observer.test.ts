// @vitest-environment node

import { createRoot } from '@fictjs/runtime';
import { afterEach, describe, expect, it } from 'vitest';
import { useSize } from '../../src/browser/useSize';
import { useIntersectionObserver } from '../../src/observer/useIntersectionObserver';
import { useMutationObserver } from '../../src/observer/useMutationObserver';
import { useResizeObserver } from '../../src/observer/useResizeObserver';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  constructor() {
    MockResizeObserver.instances.push(this);
  }

  observe() {}
  disconnect() {}
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  constructor() {
    MockIntersectionObserver.instances.push(this);
  }

  observe() {}
  disconnect() {}
}

class MockMutationObserver {
  static instances: MockMutationObserver[] = [];

  constructor() {
    MockMutationObserver.instances.push(this);
  }

  observe() {}
  disconnect() {}
}

const globalWithObservers = globalThis as typeof globalThis & {
  ResizeObserver?: typeof ResizeObserver;
  IntersectionObserver?: typeof IntersectionObserver;
  MutationObserver?: typeof MutationObserver;
};

const originalResizeObserver = globalWithObservers.ResizeObserver;
const originalIntersectionObserver = globalWithObservers.IntersectionObserver;
const originalMutationObserver = globalWithObservers.MutationObserver;

function createElementLike(): Element {
  return {
    getBoundingClientRect() {
      return {
        x: 0,
        y: 0,
        width: 10,
        height: 20,
        top: 0,
        left: 0,
        right: 10,
        bottom: 20,
        toJSON() {
          return {};
        }
      } as DOMRect;
    }
  } as Element;
}

describe('observer hooks in node globals', () => {
  afterEach(() => {
    globalWithObservers.ResizeObserver = originalResizeObserver;
    globalWithObservers.IntersectionObserver = originalIntersectionObserver;
    globalWithObservers.MutationObserver = originalMutationObserver;
    MockResizeObserver.instances = [];
    MockIntersectionObserver.instances = [];
    MockMutationObserver.instances = [];
  });

  it('does not use global observer constructors without a browser window', () => {
    globalWithObservers.ResizeObserver = MockResizeObserver as never;
    globalWithObservers.IntersectionObserver = MockIntersectionObserver as never;
    globalWithObservers.MutationObserver = MockMutationObserver as never;

    const element = createElementLike();
    const resize = createRoot(() => useResizeObserver(element)).value;
    const intersection = createRoot(() => useIntersectionObserver(element)).value;
    const mutation = createRoot(() => useMutationObserver(element)).value;
    const size = createRoot(() => useSize(element)).value;

    expect(resize.isSupported()).toBe(false);
    expect(intersection.isSupported()).toBe(false);
    expect(mutation.isSupported()).toBe(false);
    expect(size.isSupported()).toBe(false);
    expect(MockResizeObserver.instances).toHaveLength(0);
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(MockMutationObserver.instances).toHaveLength(0);
  });
});
