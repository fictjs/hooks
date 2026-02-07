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
  return combo
    .split(/[.+]/g)
    .map((part) => normalizeToken(part))
    .filter(Boolean);
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
  const passive = options.preventDefault ? false : options.passive;

  return useEventListener(
    target,
    events,
    (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (!matchesFilter(keyboardEvent, filter, exactMatch)) {
        return;
      }

      if (options.preventDefault) {
        keyboardEvent.preventDefault();
      }

      handler(keyboardEvent);
    },
    {
      passive,
      capture: options.capture,
      immediate: options.immediate
    }
  );
}
