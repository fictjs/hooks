import { createSignal } from '@fictjs/runtime/advanced';

export interface UseToggleReturn {
  value: () => boolean;
  toggle: () => void;
  set: (next: boolean) => void;
  setTrue: () => void;
  setFalse: () => void;
}

/**
 * Boolean state helper.
 *
 * @fictReturn { value: 'signal' }
 */
export function useToggle(initial = false): UseToggleReturn {
  const value = createSignal(initial);

  return {
    value,
    toggle() {
      value(!value());
    },
    set(next) {
      value(next);
    },
    setTrue() {
      value(true);
    },
    setFalse() {
      value(false);
    }
  };
}
