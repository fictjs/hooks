# usePermission

## Purpose

Read and track browser permission state reactively.

## API

```ts
function usePermission(
  permission: PermissionDescriptor | PermissionName | (() => PermissionDescriptor | PermissionName),
  options?: {
    navigator?: Navigator | null;
    initialState?: PermissionState;
    immediate?: boolean;
  }
): {
  state: () => PermissionState;
  isSupported: () => boolean;
  query: () => Promise<PermissionStatus | null>;
};
```

## Notes

- Supports string permission names and full descriptors.
- Listens to `PermissionStatus` `change` events and updates automatically.
