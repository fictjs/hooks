export const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

export const defaultWindow = isClient ? window : undefined;
export const defaultDocument = isClient ? document : undefined;
export const defaultNavigator = typeof navigator !== 'undefined' ? navigator : undefined;
