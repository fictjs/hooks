# useDocumentVisibility

## Purpose

Track `document.visibilityState` and whether the page is hidden.

## API

```ts
function useDocumentVisibility(options?: {
  document?: Document | null;
  initialVisibility?: DocumentVisibilityState;
}): {
  visibility: () => DocumentVisibilityState;
  hidden: () => boolean;
};
```
