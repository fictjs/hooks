import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('distribution runtime', () => {
  it.each(['esm', 'cjs'])('executes useDocumentVisibility from the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-document-visibility.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])(
    'executes legacy useMediaQuery cleanup from the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-media-query.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])('executes usePermission from the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-permission.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])('executes useWindowSize from the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-window-size.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])('executes useFullscreen from the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-fullscreen.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])(
    'keeps useRequest terminal after data-triggered disposal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-request-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps useFetch terminal after error-triggered disposal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-fetch-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );
});
