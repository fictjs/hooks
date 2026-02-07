# useClickOutside

## Purpose

Run a handler when a pointer/click interaction happens outside target elements.

## API

```ts
function useClickOutside(
  target: Element | Element[] | RefLike<Element> | (() => Element | null),
  handler: (event: Event) => void,
  options?: {
    window?: Window | null;
    document?: Document | null;
    ignore?:
      | string
      | Element
      | (() => Element | null)
      | Array<string | Element | (() => Element | null)>;
    capture?: boolean;
  }
): {
  start: () => void;
  stop: () => void;
  active: () => boolean;
  trigger: (event?: Event) => void;
};
```
