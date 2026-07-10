import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('distribution runtime', () => {
  it.each(['esm', 'cjs'])(
    'preserves clipboard reset timer ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-clipboard-reset-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves clipboard timer registration ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-clipboard-timers.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])('guards clipboard backend getters in the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-clipboard-getters.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])(
    'preserves nested scroll refresh ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-scroll-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps click-outside start transactional in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-click-outside-start-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves mutation observer operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-mutation-observer-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves intersection observer operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-intersection-observer-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves resize observer restart ownership from signal notification in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-resize-observer-signal-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves event restart ownership from signal notification in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-event-listener-signal-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps useDocumentVisibility terminal after getter disposal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-visibility-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])('keeps useTitle restoration terminal in the built %s entry', (format) => {
    const fixture = resolve('test/fixtures/distribution-title-terminal.mjs');

    expect(() =>
      execFileSync(process.execPath, [fixture, format], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    ).not.toThrow();
  });

  it.each(['esm', 'cjs'])(
    'preserves interval operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-interval-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves timeout operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-timeout-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves throttle operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-throttle-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'preserves debounce operation ownership in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-debounce-reentry.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

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

  it.each(['esm', 'cjs'])(
    'keeps useWindowSize resize updates terminal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-window-size-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

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

  it.each(['esm', 'cjs'])(
    'keeps useAsyncState terminal after error-triggered disposal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-async-state-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps reentrant useResizeObserver cleanup owned in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-resize-observer-reentrant.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps reentrant useEventListener cleanup owned in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-event-listener-reentrant.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'invalidates useClickOutside callbacks after stop and restart in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-click-outside-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'invalidates useKeyPress callbacks after filter stop and restart in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-key-press-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps useIdle activity and timer operations terminal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-idle-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps useNetwork composite updates terminal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-network-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );

  it.each(['esm', 'cjs'])(
    'keeps useMediaQuery callbacks and setup terminal in the built %s entry',
    (format) => {
      const fixture = resolve('test/fixtures/distribution-media-query-terminal.mjs');

      expect(() =>
        execFileSync(process.execPath, [fixture, format], {
          cwd: process.cwd(),
          stdio: 'pipe'
        })
      ).not.toThrow();
    }
  );
});
