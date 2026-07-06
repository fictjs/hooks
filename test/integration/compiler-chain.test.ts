import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

async function loadFictPluginFactory(): Promise<FictPluginFactory> {
  const pluginModule = (await import('@fictjs/vite-plugin')) as {
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

describe('compiler chain integration', () => {
  it('keeps reactive destructuring across bare @fictjs/hooks package metadata imports', async () => {
    const fict = await loadFictPluginFactory();
    const plugin = fict({
      dev: true,
      include: ['**/*.ts', '**/*.tsx'],
      useTypeScriptProject: false
    });

    const tempRoot = mkdtempSync(path.join(tmpdir(), 'fict-hooks-compiler-chain-'));
    const hooksPackageDir = path.join(tempRoot, 'node_modules/@fictjs/hooks');
    const hooksDistDir = path.join(hooksPackageDir, 'dist');
    const appEntry = path.join(tempRoot, 'App.tsx');

    mkdirSync(hooksDistDir, { recursive: true });

    const appSource = `
      import { useCounter } from '@fictjs/hooks';

      export function App() {
        const { count } = useCounter();
        return <div>{count}</div>;
      }
    `;

    writeFileSync(
      path.join(hooksPackageDir, 'package.json'),
      JSON.stringify({
        name: '@fictjs/hooks',
        version: '0.0.0-test',
        type: 'module',
        exports: {
          '.': './dist/index.js'
        },
        fict: {
          metadata: './dist/index.fict.meta.json'
        }
      }),
      'utf8'
    );
    writeFileSync(path.join(hooksDistDir, 'index.js'), 'export function useCounter() {}', 'utf8');
    writeFileSync(
      path.join(hooksDistDir, 'index.fict.meta.json'),
      JSON.stringify({
        version: 1,
        exports: {},
        hooks: {
          useCounter: {
            objectProps: {
              count: 'signal'
            }
          }
        }
      }),
      'utf8'
    );
    writeFileSync(appEntry, appSource, 'utf8');

    plugin.configResolved?.({
      command: 'build',
      mode: 'test',
      root: tempRoot,
      base: '/',
      build: { ssr: false },
      resolve: {
        alias: []
      },
      logger: {
        info() {}
      }
    });

    try {
      const appResult = await runTransform(plugin, appSource, appEntry);
      expect(appResult).not.toBeNull();
      expect(appResult?.code).toMatch(/count\(\)/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
