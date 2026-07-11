/** Prevent a secondary parameter from contributing inference on TypeScript versions before 5.4. */
export type NoInferCompat<T> = [T][T extends unknown ? 0 : never];
