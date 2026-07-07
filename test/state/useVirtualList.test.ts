import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useVirtualList } from '../../src/state/useVirtualList';

describe('useVirtualList', () => {
  it('computes visible items from start', () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 20,
        containerHeight: 100,
        overscan: 1
      })
    );

    const list = state.list();
    expect(list[0]?.index).toBe(0);
    expect(list.length).toBe(7);
    expect(state.totalHeight()).toBe(2000);
  });

  it('updates visible window on scroll', () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 20,
        containerHeight: 100,
        overscan: 1
      })
    );

    state.setScrollTop(200);

    const list = state.list();
    expect(state.start()).toBe(9);
    expect(list[0]?.index).toBe(9);
  });

  it('clamps direct scrollTop signal writes', () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 20,
        containerHeight: 100
      })
    );

    (state.scrollTop as (next: number) => void)(-10);

    expect(state.scrollTop()).toBe(0);
    expect(state.start()).toBe(0);
  });

  it('includes partially visible trailing item with zero overscan', () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 20,
        containerHeight: 100,
        initialScrollTop: 5,
        overscan: 0
      })
    );

    const list = state.list();
    expect(state.start()).toBe(0);
    expect(state.end()).toBe(6);
    expect(list).toHaveLength(6);
    expect(list[list.length - 1]?.index).toBe(5);
  });

  it('rejects invalid itemHeight values', () => {
    for (const itemHeight of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() =>
        createRoot(() =>
          useVirtualList([1], {
            itemHeight,
            containerHeight: 100
          })
        )
      ).toThrow(RangeError);
    }
  });

  it('clamps negative overscan to zero', () => {
    const items = Array.from({ length: 100 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 20,
        containerHeight: 100,
        overscan: -3
      })
    );

    state.setScrollTop(200);

    const list = state.list();
    expect(state.start()).toBe(10);
    expect(state.end()).toBe(15);
    expect(list).toHaveLength(5);
    expect(list[0]?.index).toBe(10);
  });

  it('normalizes non-finite overscan to the default', () => {
    for (const overscan of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { value: state } = createRoot(() =>
        useVirtualList([1, 2, 3], {
          itemHeight: 20,
          containerHeight: 20,
          overscan
        })
      );

      expect(Number.isNaN(state.start())).toBe(false);
      expect(Number.isNaN(state.end())).toBe(false);
      expect(state.start()).toBe(0);
      expect(state.end()).toBe(3);
      expect(state.list()).toHaveLength(3);
    }
  });

  it('normalizes non-finite initial scroll positions', () => {
    for (const initialScrollTop of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    ]) {
      const { value: state } = createRoot(() =>
        useVirtualList([1, 2, 3], {
          itemHeight: 20,
          containerHeight: 20,
          initialScrollTop
        })
      );

      expect(state.scrollTop()).toBe(0);
      expect(state.start()).toBe(0);
      expect(state.end()).toBe(3);
    }
  });

  it('normalizes non-finite scrollTop writes', () => {
    const { value: state } = createRoot(() =>
      useVirtualList([1, 2, 3], {
        itemHeight: 20,
        containerHeight: 20
      })
    );

    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      state.setScrollTop(60);
      state.setScrollTop(value);

      expect(state.scrollTop()).toBe(0);
      expect(state.start()).toBe(0);
      expect(state.end()).toBe(3);

      state.setScrollTop(60);
      (state.scrollTop as (next: number) => void)(value);

      expect(state.scrollTop()).toBe(0);
      expect(state.start()).toBe(0);
      expect(state.end()).toBe(3);
    }
  });

  it('normalizes non-finite and negative container heights', () => {
    for (const containerHeight of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1
    ]) {
      const { value: state } = createRoot(() =>
        useVirtualList([1, 2, 3, 4, 5], {
          itemHeight: 20,
          containerHeight
        })
      );

      expect(Number.isNaN(state.end())).toBe(false);
      expect(state.start()).toBe(0);
      expect(state.end()).toBe(4);
      expect(state.list()).toHaveLength(4);
    }
  });

  it('supports scrollTo and onScroll', () => {
    const items = Array.from({ length: 50 }, (_, i) => i + 1);

    const { value: state } = createRoot(() =>
      useVirtualList(items, {
        itemHeight: 10,
        containerHeight: 50
      })
    );

    state.scrollTo(12);
    expect(state.scrollTop()).toBe(120);

    const container = document.createElement('div');
    container.scrollTop = 80;
    state.onScroll({ target: container } as unknown as Event);
    expect(state.scrollTop()).toBe(80);
  });
});
