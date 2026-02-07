# useNetwork

## Purpose

Track online status and connection metadata when available.

## API

```ts
function useNetwork(options?: { window?: Window | null; navigator?: Navigator | null }): {
  online: () => boolean;
  downlink: () => number | null;
  effectiveType: () => string | null;
  rtt: () => number | null;
  saveData: () => boolean;
  type: () => string | null;
  isSupported: () => boolean;
};
```
