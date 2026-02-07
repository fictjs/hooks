import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useLocalStorage } from '../../src/storage/useLocalStorage';

describe('useLocalStorage', () => {
  it('reads and writes localStorage', () => {
    localStorage.removeItem('fict-local');

    const { value: state } = createRoot(() => useLocalStorage('fict-local', 5));

    expect(state.value()).toBe(5);

    state.set(9);
    expect(localStorage.getItem('fict-local')).toBe('9');

    state.remove();
    expect(localStorage.getItem('fict-local')).toBeNull();
  });
});
