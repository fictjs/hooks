import { toArray, toValue, type MaybeAccessor } from './value';

export interface RefLike<T> {
  current: T | null | undefined;
}

export type MaybeRefOrAccessor<T> =
  | T
  | null
  | undefined
  | RefLike<T>
  | (() => T | null | undefined);

export function resolveTarget<T>(target: MaybeRefOrAccessor<T>): T | undefined {
  if (target == null) {
    return undefined;
  }

  if (typeof target === 'function') {
    return (target as () => T | null | undefined)() ?? undefined;
  }

  if (typeof target === 'object' && 'current' in target) {
    return target.current ?? undefined;
  }

  return target;
}

export type MaybeTarget<T> = MaybeRefOrAccessor<T> | MaybeAccessor<MaybeRefOrAccessor<T>>;

export function resolveMaybeTarget<T>(target: MaybeTarget<T>): T | undefined {
  const resolved = toValue(target as MaybeAccessor<MaybeRefOrAccessor<T>>);
  return resolveTarget(resolved);
}

export function resolveTargetList<T>(
  target: MaybeTarget<T> | Array<MaybeTarget<T>>,
  canContinue: () => boolean = () => true
): T[] {
  const resolvedTargets: T[] = [];
  for (const item of toArray(target)) {
    if (!canContinue()) {
      break;
    }
    const resolved = resolveMaybeTarget(item);
    if (!canContinue()) {
      break;
    }
    if (resolved != null) {
      resolvedTargets.push(resolved);
    }
  }
  return resolvedTargets;
}

export function deferTargetResolution(callback: () => void): () => void {
  let canceled = false;
  const run = () => {
    if (!canceled) {
      callback();
    }
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(run);
  } else {
    void Promise.resolve().then(run);
  }

  return () => {
    canceled = true;
  };
}

export type MaybeElement = MaybeTarget<Element>;

export type IgnoreTarget = MaybeElement | string;

export function resolveIgnoreElement(
  ignore: IgnoreTarget,
  doc: Document
): Element | Element[] | undefined {
  if (typeof ignore === 'string') {
    return Array.from(doc.querySelectorAll(ignore));
  }

  return resolveMaybeTarget(ignore);
}
