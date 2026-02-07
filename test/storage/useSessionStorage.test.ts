import { createRoot } from '@fictjs/runtime';
import { describe, expect, it } from 'vitest';
import { useSessionStorage } from '../../src/storage/useSessionStorage';

describe('useSessionStorage', () => {
  it('reads and writes sessionStorage', () => {
    sessionStorage.removeItem('fict-session');

    const { value: state } = createRoot(() => useSessionStorage('fict-session', 'a'));

    expect(state.value()).toBe('a');

    state.set('b');
    expect(sessionStorage.getItem('fict-session')).toBe('b');

    state.remove();
    expect(sessionStorage.getItem('fict-session')).toBeNull();
  });
});
