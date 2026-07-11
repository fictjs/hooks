import { createRequire } from 'node:module';

export async function loadDistribution() {
  if (globalThis.process.argv[2] === 'cjs') {
    const require = createRequire(import.meta.url);
    return {
      hooks: require('../../dist/index.cjs'),
      runtime: require('@fictjs/runtime'),
      internal: require('@fictjs/runtime/internal')
    };
  }

  return {
    hooks: await import('../../dist/index.js'),
    runtime: await import('@fictjs/runtime'),
    internal: await import('@fictjs/runtime/internal')
  };
}
