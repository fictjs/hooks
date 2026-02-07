import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

interface TransformResultLike {
  code: string;
}

type TransformHandler = (
  this: {
    error: (payload: unknown) => never;
    warn: (payload: unknown) => void;
    emitFile: (payload: unknown) => void;
  },
  code: string,
  id: string
) => Promise<TransformResultLike | null>;

interface FictPluginLike {
  configResolved?: (config: unknown) => void;
  transform?: TransformHandler | { handler: TransformHandler };
}

interface FictPluginFactory {
  (options?: Record<string, unknown>): FictPluginLike;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const pluginEntry = path.resolve(repoRoot, 'packages/vite-plugin/dist/index.js');
const hasLocalVitePlugin = existsSync(pluginEntry);

async function loadFictPluginFactory(): Promise<FictPluginFactory> {
  const pluginModule = (await import(pathToFileURL(pluginEntry).href)) as {
    default?: FictPluginFactory;
  };
  if (!pluginModule.default) {
    throw new Error('Failed to load @fictjs/vite-plugin default export');
  }
  return pluginModule.default;
}

async function runTransform(plugin: FictPluginLike, source: string, id: string) {
  const transform = plugin.transform;
  const context = {
    error(payload: unknown): never {
      const message =
        typeof payload === 'string'
          ? payload
          : JSON.stringify(payload, null, 2) || 'transform error';
      throw new Error(message);
    },
    warn() {},
    emitFile() {}
  };

  if (typeof transform === 'function') {
    return transform.call(context, source, id);
  }

  if (transform && typeof transform.handler === 'function') {
    return transform.handler.call(context, source, id);
  }

  throw new Error('transform hook is unavailable');
}

const runIfPluginAvailable = hasLocalVitePlugin ? it : it.skip;

describe('compiler chain integration', () => {
  runIfPluginAvailable(
    'keeps reactive destructuring across bare @fictjs/hooks imports',
    async () => {
      const fict = await loadFictPluginFactory();
      const plugin = fict({
        dev: true,
        include: ['**/*.ts', '**/*.tsx'],
        useTypeScriptProject: false,
        emitModuleMetadata: true
      });

      const tempRoot = mkdtempSync(path.join(tmpdir(), 'fict-hooks-compiler-chain-'));
      const hooksPackageDir = path.join(tempRoot, 'hooks-package');
      const hookEntry = path.join(hooksPackageDir, 'index.ts');
      const appEntry = path.join(tempRoot, 'App.tsx');

      mkdirSync(hooksPackageDir, { recursive: true });

      const hookSource = `
        import { $state } from 'fict';

        /** @fictReturn { count: 'signal' } */
        export function useCounter() {
          const count = $state(0);
          return { count };
        }
      `;

      const appSource = `
        import { useCounter } from '@fictjs/hooks';

        export function App() {
          const { count } = useCounter();
          return <div>{count}</div>;
        }
      `;

      writeFileSync(hookEntry, hookSource, 'utf8');
      writeFileSync(appEntry, appSource, 'utf8');

      plugin.configResolved?.({
        command: 'build',
        mode: 'test',
        root: tempRoot,
        base: '/',
        build: { ssr: false },
        resolve: {
          alias: [{ find: '@fictjs/hooks', replacement: hooksPackageDir }]
        },
        logger: {
          info() {}
        }
      });

      try {
        const hookResult = await runTransform(plugin, hookSource, hookEntry);
        expect(hookResult).not.toBeNull();

        const appResult = await runTransform(plugin, appSource, appEntry);
        expect(appResult).not.toBeNull();
        expect(appResult?.code).toMatch(/count\(\)/);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    }
  );
});
