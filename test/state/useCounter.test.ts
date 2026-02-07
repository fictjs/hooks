import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useCounter } from '../../src/state/useCounter';

describe('useCounter', () => {
  it('increments and decrements', () => {
    const { value: counter } = createRoot(() => useCounter(1));

    counter.inc();
    expect(counter.count()).toBe(2);

    counter.dec();
    expect(counter.count()).toBe(1);

    counter.inc(4);
    expect(counter.count()).toBe(5);

    counter.dec(2);
    expect(counter.count()).toBe(3);
  });

  it('respects min/max bounds', () => {
    const { value: counter } = createRoot(() => useCounter(5, { min: 0, max: 10 }));

    counter.inc(20);
    expect(counter.count()).toBe(10);

    counter.dec(30);
    expect(counter.count()).toBe(0);

    counter.set(100);
    expect(counter.count()).toBe(10);
  });

  it('resets to clamped initial value', () => {
    const { value: counter } = createRoot(() => useCounter(20, { max: 5 }));

    expect(counter.count()).toBe(5);
    counter.dec(2);
    expect(counter.count()).toBe(3);

    counter.reset();
    expect(counter.count()).toBe(5);
  });
});
