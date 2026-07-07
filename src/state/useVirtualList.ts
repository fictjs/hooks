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

function normalizeNonNegative(value: number | undefined, fallback = 0): number {
  const next = value ?? fallback;
  return Number.isFinite(next) ? Math.max(0, next) : fallback;
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
  const itemHeight = options.itemHeight;
  if (!Number.isFinite(itemHeight) || itemHeight <= 0) {
    throw new RangeError('useVirtualList: itemHeight must be a positive finite number');
  }

  const overscan = Math.floor(normalizeNonNegative(options.overscan, 2));

  const scrollTopSignal = createSignal(normalizeNonNegative(options.initialScrollTop));
  const scrollTop = function scrollTop(next?: number) {
    if (arguments.length === 0) {
      return scrollTopSignal();
    }
    scrollTopSignal(normalizeNonNegative(next));
  } as typeof scrollTopSignal;

  const totalHeight = createMemo(() => toValue(source as MaybeAccessor<T[]>).length * itemHeight);

  const visibleCount = createMemo(() => {
    const containerHeight = normalizeNonNegative(
      toValue(options.containerHeight as MaybeAccessor<number>)
    );
    return Math.ceil((containerHeight + (scrollTop() % itemHeight)) / itemHeight) + overscan * 2;
  });

  const start = createMemo(() => {
    const items = toValue(source as MaybeAccessor<T[]>);
    const base = Math.floor(scrollTop() / itemHeight) - overscan;
    const maxStart = Math.max(0, items.length - visibleCount());
    return Math.min(maxStart, Math.max(0, base));
  });

  const end = createMemo(() => {
    const items = toValue(source as MaybeAccessor<T[]>);
    return Math.min(items.length, start() + visibleCount());
  });

  const list = createMemo(() => {
    const items = toValue(source as MaybeAccessor<T[]>);
    const from = start();
    const to = end();

    return buildVirtualItems(items, from, to, itemHeight);
  });

  const setScrollTop = (value: number) => {
    scrollTop(value);
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
