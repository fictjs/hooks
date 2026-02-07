# useClipboard

## Purpose

Write text to clipboard and expose copy status.

## API

```ts
function useClipboard(options?: {
  navigator?: Navigator | null;
  document?: Document | null;
  window?: Window | null;
  copiedDuring?: number;
}): {
  text: () => string;
  copied: () => boolean;
  isSupported: () => boolean;
  copy: (value: string) => Promise<boolean>;
};
```
