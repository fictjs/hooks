// @vitest-environment node

import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useNetwork } from '../../src/browser/useNetwork';

describe('useNetwork in Node', () => {
  it('does not treat Node navigator as browser network support', () => {
    const { value: state } = createRoot(() => useNetwork());

    expect(state.online()).toBe(true);
    expect(state.downlink()).toBeNull();
    expect(state.effectiveType()).toBeNull();
    expect(state.isSupported()).toBe(false);
  });
});
