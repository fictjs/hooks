import fict from '@fictjs/vite-plugin';
import { defineConfig, type UserConfig } from 'tsdown';
import type { Plugin as VitePlugin, ResolvedConfig as ViteResolvedConfig } from 'vite';

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: {
    cjsReexport: false,
    sourcemap: false
  },
  deps: {
    neverBundle: [/^@fictjs\/runtime(?:\/.*)?$/]
  },
  fixedExtension: false,
  hash: false,
  outDir: 'dist',
  outExtensions: ({ format }) => ({
    dts: format === 'cjs' ? '.d.cts' : '.d.ts',
    js: format === 'cjs' ? '.cjs' : '.js'
  }),
  plugins: [fictLibraryPlugin()],
  sourcemap: false,
  target: 'es2020'
});

function fictLibraryPlugin(): NonNullable<UserConfig['plugins']> {
  const plugin = fict({ library: { packageJson: false } }) as VitePlugin;
  const transform = plugin.transform;
  const generateBundle = plugin.generateBundle;

  return {
    ...plugin,
    name: 'fict-tsdown-library-plugin',
    transform(code, id, options) {
      if (isDeclarationModule(id)) {
        return null;
      }

      return callHook(transform, this, [code, id, options]);
    },
    generateBundle(options, bundle, isWrite) {
      return callHook(generateBundle, this, [
        options,
        Object.fromEntries(
          Object.entries(bundle).filter(([, output]) => !isDeclarationModule(output.fileName))
        ),
        isWrite
      ]);
    },
    tsdownConfigResolved(config) {
      callHook(plugin.configResolved, plugin, [
        {
          base: '/',
          build: {
            outDir: config.outDir,
            ssr: false
          },
          command: 'build',
          logger: console,
          mode: 'production',
          resolve: {
            alias: [],
            preserveSymlinks: false
          },
          root: config.cwd
        } as unknown as ViteResolvedConfig
      ]);
    }
  } as NonNullable<UserConfig['plugins']>;
}

function isDeclarationModule(id: string): boolean {
  return /\.d\.[cm]?ts(?:$|\?)/.test(id);
}

function callHook(hook: unknown, context: unknown, args: unknown[]): unknown {
  if (typeof hook === 'function') {
    return hook.apply(context, args);
  }

  if (hook && typeof hook === 'object' && 'handler' in hook && typeof hook.handler === 'function') {
    return hook.handler.apply(context, args);
  }

  return null;
}
