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
