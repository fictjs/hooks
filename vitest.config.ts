import { readdirSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const PUBLIC_HOOK_FLOOR = {
  statements: 85,
  branches: 70,
  functions: 50,
  lines: 85
};

function findHookFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findHookFiles(file);
    }
    return /^use[A-Z].*\.ts$/.test(entry.name) ? [file.split(path.sep).join('/')] : [];
  });
}

const publicHookThresholds = Object.fromEntries(
  findHookFiles('src').map((file) => [file, PUBLIC_HOOK_FLOOR])
);

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
        ...publicHookThresholds,
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
