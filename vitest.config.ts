import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
        'src/clipboard/useClipboard.ts': {
          statements: 95,
          branches: 85,
          functions: 95,
          lines: 95
        },
        'src/browser/useFullscreen.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95
        },
        'src/browser/useScroll.ts': {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95
        }
      }
    }
  }
});
