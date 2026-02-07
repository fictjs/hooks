import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useToggle } from '../../src/state/useToggle';

describe('useToggle', () => {
  it('toggles from initial value', () => {
    const { value: toggle } = createRoot(() => useToggle());

    expect(toggle.value()).toBe(false);
    toggle.toggle();
    expect(toggle.value()).toBe(true);
    toggle.toggle();
    expect(toggle.value()).toBe(false);
  });

  it('supports explicit setters', () => {
    const { value: toggle } = createRoot(() => useToggle(true));

    toggle.setFalse();
    expect(toggle.value()).toBe(false);

    toggle.setTrue();
    expect(toggle.value()).toBe(true);

    toggle.set(false);
    expect(toggle.value()).toBe(false);
  });
});
