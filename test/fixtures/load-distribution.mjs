import { createRequire } from 'node:module';

export async function loadDistribution() {
  if (globalThis.process.argv[2] === 'cjs') {
    const require = createRequire(import.meta.url);
    return {
      hooks: require('../../dist/index.cjs'),
      runtime: require('@fictjs/runtime'),
      advanced: require('@fictjs/runtime/advanced'),
      internal: require('@fictjs/runtime/internal')
    };
  }

  return {
    hooks: await import('../../dist/index.js'),
    runtime: await import('@fictjs/runtime'),
    advanced: await import('@fictjs/runtime/advanced'),
    internal: await import('@fictjs/runtime/internal')
  };
}
