import { defaultWindow } from '../internal/env';
import type { MaybeTarget } from '../internal/target';
import { toArray } from '../internal/value';
import { useEventListener, type UseEventListenerControls } from './useEventListener';

export type KeyEventName = 'keydown' | 'keyup' | 'keypress';
export type KeyFilter = string | string[] | ((event: KeyboardEvent) => boolean);

export interface UseKeyPressOptions {
  target?: MaybeTarget<EventTarget> | Array<MaybeTarget<EventTarget>> | null;
  events?: KeyEventName | KeyEventName[];
  exactMatch?: boolean;
  passive?: boolean;
  capture?: boolean;
  preventDefault?: boolean;
  immediate?: boolean;
  ignoreRepeat?: boolean;
  ignoreComposing?: boolean;
}

const modifierAliases: Record<string, 'ctrl' | 'alt' | 'shift' | 'meta'> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta'
};

const keyAliases: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  del: 'delete',
  space: ' ',
  spacebar: ' '
};

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function normalizeKey(key: string): string {
  const normalized = normalizeToken(key);
  return keyAliases[normalized] ?? normalized;
}

function parseCombo(combo: string): string[] {
  const tokens: string[] = [];
  let current = '';

  for (let index = 0; index < combo.length; index += 1) {
    const char = combo[index]!;
    if (char !== '.' && char !== '+') {
      current += char;
      continue;
    }

    if (current.trim()) {
      tokens.push(current);
      current = '';
      if (index === combo.length - 1) {
        tokens.push(char);
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current);
  }

  return tokens.map((part) => normalizeToken(part)).filter(Boolean);
}

function isModifierToken(token: string): boolean {
  return token in modifierAliases;
}

function isModifierActive(
  modifier: 'ctrl' | 'alt' | 'shift' | 'meta',
  event: KeyboardEvent
): boolean {
  if (modifier === 'ctrl') return event.ctrlKey;
  if (modifier === 'alt') return event.altKey;
  if (modifier === 'shift') return event.shiftKey;
  return event.metaKey;
}

function activeModifierCount(event: KeyboardEvent): number {
  return (
    Number(event.ctrlKey) + Number(event.altKey) + Number(event.shiftKey) + Number(event.metaKey)
  );
}

function matchesCombo(event: KeyboardEvent, combo: string, exactMatch: boolean): boolean {
  const tokens = parseCombo(combo);
  if (tokens.length === 0) {
    return false;
  }

  const modifiers = tokens.filter(isModifierToken).map((token) => modifierAliases[token]);
  const nonModifiers = tokens.filter((token) => !isModifierToken(token));

  for (const modifier of modifiers) {
    if (!isModifierActive(modifier, event)) {
      return false;
    }
  }

  const keyMatched =
    nonModifiers.length === 0 ||
    nonModifiers.some((token) => normalizeKey(token) === normalizeKey(event.key));

  if (!keyMatched) {
    return false;
  }

  if (!exactMatch) {
    return true;
  }

  const expectedModifierCount = new Set(modifiers).size;
  return activeModifierCount(event) === expectedModifierCount;
}

function matchesFilter(event: KeyboardEvent, filter: KeyFilter, exactMatch: boolean): boolean {
  if (typeof filter === 'function') {
    return filter(event);
  }

  const combos = toArray(filter);
  return combos.some((combo) => matchesCombo(event, combo, exactMatch));
}

/**
 * Listen to keyboard events with key-filter matching.
 *
 * @fictReturn { active: 'signal' }
 */
export function useKeyPress(
  filter: KeyFilter,
  handler: (event: KeyboardEvent) => void,
  options: UseKeyPressOptions = {}
): UseEventListenerControls {
  const events = toArray(options.events ?? 'keydown');
  const exactMatch = options.exactMatch ?? false;
  const target = options.target === undefined ? defaultWindow : options.target;
  const preventDefault = options.preventDefault ?? false;
  const passive = preventDefault ? false : options.passive;
  const ignoreRepeat = options.ignoreRepeat ?? false;
  const ignoreComposing = options.ignoreComposing ?? true;
  let operation = 0;
  let isActiveOperation: (currentOperation: number) => boolean = () => false;

  const controls = useEventListener(
    target,
    events,
    (event) => {
      const currentOperation = operation;
      const isCurrent = () => isActiveOperation(currentOperation);
      if (!isCurrent()) {
        return;
      }

      const keyboardEvent = event as KeyboardEvent;
      const repeated = ignoreRepeat && keyboardEvent.repeat;
      if (!isCurrent() || repeated) {
        return;
      }
      const composing = ignoreComposing && keyboardEvent.isComposing;
      if (!isCurrent() || composing) {
        return;
      }

      const matched = matchesFilter(keyboardEvent, filter, exactMatch);
      if (!isCurrent() || !matched) {
        return;
      }

      if (preventDefault) {
        keyboardEvent.preventDefault();
        if (!isCurrent()) {
          return;
        }
      }

      handler(keyboardEvent);
    },
    {
      passive,
      capture: options.capture,
      immediate: options.immediate
    }
  );
  isActiveOperation = (currentOperation) => currentOperation === operation && controls.active();

  const start = controls.start;
  const stop = controls.stop;
  const refresh = controls.refresh;
  controls.start = () => {
    operation += 1;
    start();
  };
  controls.stop = () => {
    operation += 1;
    stop();
  };
  controls.refresh = () => {
    operation += 1;
    refresh();
  };

  return controls;
}
