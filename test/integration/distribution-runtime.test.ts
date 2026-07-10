import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('distribution runtime', () => {
  it('executes usePermission from the built ESM entry', () => {
    const fixture = resolve('test/fixtures/distribution-permission.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });
});
