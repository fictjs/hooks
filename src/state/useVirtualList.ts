import { createMemo } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import { toValue, type MaybeAccessor } from '../internal/value';

export interface VirtualItem<T> {
  index: number;
  data: T;
  start: number;
  end: number;
}

export interface UseVirtualListOptions {
  itemHeight: number;
  containerHeight: number | MaybeAccessor<number>;
  overscan?: number;
  initialScrollTop?: number;
}

export interface UseVirtualListReturn<T> {
  list: () => VirtualItem<T>[];
  totalHeight: () => number;
  start: () => number;
  end: () => number;
  scrollTop: () => number;
  setScrollTop: (value: number) => void;
  scrollTo: (index: number) => void;
  onScroll: (event: Event) => void;
}

function buildVirtualItems<T>(
  items: T[],
  from: number,
  to: number,
  itemHeight: number
): VirtualItem<T>[] {
  const result: VirtualItem<T>[] = [];
  for (let index = from; index < to; index += 1) {
    result.push({
      index,
      data: items[index]!,
      start: index * itemHeight,
      end: (index + 1) * itemHeight
    });
  }
  return result;
}

/**
 * Fixed-height virtual list state helper.
 *
 * @fictReturn { list: 'memo', totalHeight: 'memo', start: 'memo', end: 'memo', scrollTop: 'signal' }
 */
export function useVirtualList<T>(
  source: T[] | MaybeAccessor<T[]>,
  options: UseVirtualListOptions
): UseVirtualListReturn<T> {
  const overscan = options.overscan ?? 2;
  const itemHeight = options.itemHeight;

  const scrollTopSignal = createSignal(Math.max(0, options.initialScrollTop ?? 0));
  const scrollTop = function scrollTop(next?: number) {
    if (arguments.length === 0) {
      return scrollTopSignal();
    }
    scrollTopSignal(Math.max(0, next ?? 0));
  } as typeof scrollTopSignal;

  const totalHeight = createMemo(() => toValue(source as MaybeAccessor<T[]>).length * itemHeight);

  const start = createMemo(() => {
    const base = Math.floor(scrollTop() / itemHeight) - overscan;
    return Math.max(0, base);
  });

  const end = createMemo(() => {
    const items = toValue(source as MaybeAccessor<T[]>);
    const containerHeight = toValue(options.containerHeight as MaybeAccessor<number>);
    const visibleCount =
      Math.ceil((containerHeight + (scrollTop() % itemHeight)) / itemHeight) + overscan * 2;
    return Math.min(items.length, start() + visibleCount);
  });

  const list = createMemo(() => {
    const items = toValue(source as MaybeAccessor<T[]>);
    const from = start();
    const to = end();

    return buildVirtualItems(items, from, to, itemHeight);
  });

  const setScrollTop = (value: number) => {
    scrollTop(Math.max(0, value));
  };

  const scrollTo = (index: number) => {
    setScrollTop(index * itemHeight);
  };

  const onScroll = (event: Event) => {
    const element = event.target as HTMLElement | null;
    if (!element) {
      return;
    }
    setScrollTop(element.scrollTop);
  };

  return {
    list,
    totalHeight,
    start,
    end,
    scrollTop,
    setScrollTop,
    scrollTo,
    onScroll
  };
}
