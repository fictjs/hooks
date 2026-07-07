import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  it('keeps reactive accessors across real @fictjs/hooks package metadata imports', async () => {
    const fict = await loadFictPluginFactory();
    const plugin = fict({
      dev: true,
      include: ['**/*.ts', '**/*.tsx'],
      useTypeScriptProject: false
    });

    const tempRoot = mkdtempSync(path.join(tmpdir(), 'fict-hooks-compiler-chain-'));
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const distIndexPath = path.join(repoRoot, 'dist/index.js');
    const distMetadataPath = path.join(repoRoot, 'dist/index.fict.meta.json');
    const hooksPackageDir = path.join(tempRoot, 'node_modules/@fictjs/hooks');
    const hooksDistDir = path.join(hooksPackageDir, 'dist');
    const appEntry = path.join(tempRoot, 'App.tsx');

    if (!existsSync(distIndexPath) || !existsSync(distMetadataPath)) {
      throw new Error('compiler-chain integration requires pnpm build before vitest');
    }

    mkdirSync(hooksDistDir, { recursive: true });

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      name: string;
      version: string;
      type: string;
      exports: unknown;
      fict: unknown;
    };
    const appSource = `
      import { useCounter, usePrevious, useStorage, useVirtualList } from '@fictjs/hooks';

      export function App() {
        const { count } = useCounter();
        const previous = usePrevious(count);
        const { value } = useStorage('compiler-chain', 1, { window: null });
        const { list, totalHeight } = useVirtualList([1, 2, 3], {
          itemHeight: 20,
          containerHeight: 40
        });

        return <div>{count}{previous}{value}{list.length}{totalHeight}</div>;
      }
    `;

    writeFileSync(
      path.join(hooksPackageDir, 'package.json'),
      JSON.stringify({
        name: packageJson.name,
        version: packageJson.version,
        type: packageJson.type,
        exports: packageJson.exports,
        fict: packageJson.fict
      }),
      'utf8'
    );
    copyFileSync(distIndexPath, path.join(hooksDistDir, 'index.js'));
    copyFileSync(distMetadataPath, path.join(hooksDistDir, 'index.fict.meta.json'));
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
      expect(appResult?.code).toMatch(/previous\(\)/);
      expect(appResult?.code).toMatch(/value\(\)/);
      expect(appResult?.code).toMatch(/list\(\)\.length/);
      expect(appResult?.code).toMatch(/totalHeight\(\)/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
