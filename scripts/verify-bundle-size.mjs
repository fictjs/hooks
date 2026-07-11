/* global console, process */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const maxGzipBytes = 22 * 1024;
const entries = ['dist/index.js', 'dist/index.cjs'];
const results = entries.map((entry) => {
  const source = readFileSync(path.join(process.cwd(), entry));
  return {
    entry,
    gzipBytes: gzipSync(source).byteLength
  };
});

const oversized = results.filter(({ gzipBytes }) => gzipBytes > maxGzipBytes);
if (oversized.length > 0) {
  for (const { entry, gzipBytes } of oversized) {
    console.error(
      `${entry} is ${gzipBytes} gzip bytes, above the ${maxGzipBytes} byte release limit`
    );
  }
  process.exit(1);
}

console.log(
  `bundle size verification passed: ${results
    .map(({ entry, gzipBytes }) => `${entry}=${gzipBytes} gzip bytes`)
    .join(', ')}`
);
