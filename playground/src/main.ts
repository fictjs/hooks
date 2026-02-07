import { createEffect, createRoot } from '@fictjs/runtime';
import { createSignal } from '@fictjs/runtime/advanced';
import {
  useAsyncState,
  useClickOutside,
  useClipboard,
  useCounter,
  useDebounceFn,
  useDocumentVisibility,
  useEventListener,
  useFetch,
  useIntervalFn,
  useLocalStorage,
  useMediaQuery,
  useMount,
  useNetwork,
  useRafFn,
  useRequest,
  useThrottleFn,
  useTimeoutFn,
  useToggle,
  useUnmount,
  useVirtualList,
  useWindowSize
} from '../../src/index';

interface DemoCard {
  title: string;
  tag: string;
  mount: (container: HTMLElement) => void;
}

const disposers: Array<() => void> = [];

function runInRoot(setup: () => void): void {
  const { dispose } = createRoot(setup);
  disposers.push(dispose);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function outputLine(label: string): { wrap: HTMLDivElement; value: HTMLSpanElement } {
  const wrap = element('div', 'small mono');
  const key = element('span');
  key.textContent = `${label}: `;
  const value = element('span');
  wrap.append(key, value);
  return { wrap, value };
}

function header(): HTMLElement {
  const hero = element('section', 'hero');
  const title = element('h1');
  title.textContent = 'Fict Hooks Lab';

  const desc = element('p');
  desc.innerHTML =
    'Interactive demo website for <code>@fictjs/hooks</code>. Every card uses real runtime hooks with live state.';

  hero.append(title, desc);
  return hero;
}

const cards: DemoCard[] = [
  {
    title: 'useMount / useUnmount',
    tag: 'lifecycle',
    mount(container) {
      const controls = element('div', 'controls');
      const mountBtn = element('button', 'primary');
      mountBtn.textContent = 'mount child root';
      const unmountBtn = element('button');
      unmountBtn.textContent = 'dispose child root';

      const mountLine = outputLine('mounted');
      const unmountLine = outputLine('unmounted');
      const activeLine = outputLine('active');

      container.append(controls, mountLine.wrap, unmountLine.wrap, activeLine.wrap);
      controls.append(mountBtn, unmountBtn);

      runInRoot(() => {
        const mountedCount = createSignal(0);
        const unmountedCount = createSignal(0);
        const active = createSignal(false);

        let childDispose: (() => void) | undefined;

        const mountChild = () => {
          if (childDispose) {
            childDispose();
          }

          const { dispose } = createRoot(() => {
            useMount(() => {
              mountedCount(mountedCount() + 1);
            });
            useUnmount(() => {
              unmountedCount(unmountedCount() + 1);
            });
          });

          childDispose = dispose;
          active(true);
        };

        const unmountChild = () => {
          if (!childDispose) {
            return;
          }
          childDispose();
          childDispose = undefined;
          active(false);
        };

        mountBtn.onclick = mountChild;
        unmountBtn.onclick = unmountChild;

        createEffect(() => {
          mountLine.value.textContent = String(mountedCount());
          unmountLine.value.textContent = String(unmountedCount());
          activeLine.value.textContent = active() ? 'yes' : 'no';
        });
      });
    }
  },
  {
    title: 'useToggle',
    tag: 'state',
    mount(container) {
      const controls = element('div', 'controls');
      const toggleBtn = element('button', 'primary');
      toggleBtn.textContent = 'toggle';
      const forceOn = element('button');
      forceOn.textContent = 'set true';
      const forceOff = element('button');
      forceOff.textContent = 'set false';
      const state = element('div', 'output mono');

      controls.append(toggleBtn, forceOn, forceOff);
      container.append(controls, state);

      runInRoot(() => {
        const model = useToggle(false);

        toggleBtn.onclick = model.toggle;
        forceOn.onclick = model.setTrue;
        forceOff.onclick = model.setFalse;

        createEffect(() => {
          state.textContent = model.value() ? 'ON' : 'OFF';
        });
      });
    }
  },
  {
    title: 'useCounter',
    tag: 'state',
    mount(container) {
      const controls = element('div', 'controls');
      const incBtn = element('button', 'primary');
      incBtn.textContent = '+1';
      const decBtn = element('button');
      decBtn.textContent = '-1';
      const resetBtn = element('button');
      resetBtn.textContent = 'reset';
      const value = element('div', 'output mono');

      controls.append(incBtn, decBtn, resetBtn);
      container.append(controls, value);

      runInRoot(() => {
        const counter = useCounter(4, { min: 0, max: 10 });

        incBtn.onclick = () => counter.inc();
        decBtn.onclick = () => counter.dec();
        resetBtn.onclick = counter.reset;

        createEffect(() => {
          value.textContent = `count: ${counter.count()} (min 0 / max 10)`;
        });
      });
    }
  },
  {
    title: 'useDebounceFn / useThrottleFn',
    tag: 'timing',
    mount(container) {
      const input = element('input');
      input.placeholder = 'type quickly';
      const debouncedOut = outputLine('debounced');
      const throttledOut = outputLine('throttle-hit');

      container.append(input, debouncedOut.wrap, throttledOut.wrap);

      runInRoot(() => {
        const debouncedText = createSignal('');
        const throttleHits = createSignal(0);

        const debounced = useDebounceFn((value: string) => {
          debouncedText(value);
        }, 500);

        const throttled = useThrottleFn(() => {
          throttleHits(throttleHits() + 1);
        }, 500);

        input.oninput = () => {
          debounced.run(input.value);
          throttled.run();
        };

        createEffect(() => {
          debouncedOut.value.textContent = debouncedText();
          throttledOut.value.textContent = String(throttleHits());
        });
      });
    }
  },
  {
    title: 'useTimeoutFn / useIntervalFn',
    tag: 'timing',
    mount(container) {
      const controls = element('div', 'controls');
      const restartTimeout = element('button', 'primary');
      restartTimeout.textContent = 'restart timeout';
      const stopInterval = element('button');
      stopInterval.textContent = 'pause interval';
      const startInterval = element('button');
      startInterval.textContent = 'resume interval';

      const timeoutLine = outputLine('timeout-fired');
      const intervalLine = outputLine('interval-ticks');

      controls.append(restartTimeout, stopInterval, startInterval);
      container.append(controls, timeoutLine.wrap, intervalLine.wrap);

      runInRoot(() => {
        const timeoutFired = createSignal(0);
        const intervalTicks = createSignal(0);

        const timeout = useTimeoutFn(() => {
          timeoutFired(timeoutFired() + 1);
        }, 1800);

        const interval = useIntervalFn(() => {
          intervalTicks(intervalTicks() + 1);
        }, 900);

        restartTimeout.onclick = timeout.run;
        stopInterval.onclick = interval.cancel;
        startInterval.onclick = interval.run;

        createEffect(() => {
          timeoutLine.value.textContent = String(timeoutFired());
          intervalLine.value.textContent = String(intervalTicks());
        });
      });
    }
  },
  {
    title: 'useRafFn',
    tag: 'timing',
    mount(container) {
      const controls = element('div', 'controls');
      const startBtn = element('button', 'primary');
      startBtn.textContent = 'start raf';
      const stopBtn = element('button');
      stopBtn.textContent = 'stop raf';
      const line = outputLine('frames');

      controls.append(startBtn, stopBtn);
      container.append(controls, line.wrap);

      runInRoot(() => {
        const frameCount = createSignal(0);

        const raf = useRafFn(
          () => {
            frameCount(frameCount() + 1);
          },
          { immediate: false }
        );

        startBtn.onclick = raf.start;
        stopBtn.onclick = raf.stop;

        createEffect(() => {
          line.value.textContent = String(frameCount());
        });
      });
    }
  },
  {
    title: 'useEventListener + useClickOutside',
    tag: 'event',
    mount(container) {
      const controls = element('div', 'controls');
      const openBtn = element('button', 'primary');
      openBtn.textContent = 'toggle popover';
      const startBtn = element('button');
      startBtn.textContent = 'track pointerdown';
      const stopBtn = element('button');
      stopBtn.textContent = 'stop tracking';

      const popover = element('div', 'output');
      popover.textContent = 'Popover: click outside this card to close';

      const clicks = outputLine('pointerdown count');
      const openState = outputLine('popover open');

      container.append(controls, popover, clicks.wrap, openState.wrap);
      controls.append(openBtn, startBtn, stopBtn);

      runInRoot(() => {
        const pointerdownCount = createSignal(0);
        const popoverOpen = createSignal(false);

        const listener = useEventListener(window, 'pointerdown', () => {
          pointerdownCount(pointerdownCount() + 1);
        });

        const popoverRef = { current: popover as Element };
        useClickOutside(
          popoverRef,
          () => {
            popoverOpen(false);
          },
          { ignore: [openBtn] }
        );

        openBtn.onclick = () => {
          popoverOpen(!popoverOpen());
        };
        startBtn.onclick = listener.start;
        stopBtn.onclick = listener.stop;

        createEffect(() => {
          clicks.value.textContent = String(pointerdownCount());
          openState.value.textContent = popoverOpen() ? 'yes' : 'no';
          popover.style.display = popoverOpen() ? 'block' : 'none';
        });
      });
    }
  },
  {
    title: 'useWindowSize + useMediaQuery',
    tag: 'browser',
    mount(container) {
      const sizeLine = outputLine('window');
      const mediaLine = outputLine('max-width: 760');

      container.append(sizeLine.wrap, mediaLine.wrap);

      runInRoot(() => {
        const size = useWindowSize();
        const media = useMediaQuery('(max-width: 760px)');

        createEffect(() => {
          sizeLine.value.textContent = `${size.width()} x ${size.height()}`;
          mediaLine.value.textContent = media.matches() ? 'true' : 'false';
        });
      });
    }
  },
  {
    title: 'useDocumentVisibility + useNetwork',
    tag: 'browser',
    mount(container) {
      const visibilityLine = outputLine('visibility');
      const onlineLine = outputLine('online');
      const typeLine = outputLine('effective type');

      container.append(visibilityLine.wrap, onlineLine.wrap, typeLine.wrap);

      runInRoot(() => {
        const visibility = useDocumentVisibility();
        const network = useNetwork();

        createEffect(() => {
          visibilityLine.value.textContent = visibility.visibility();
          onlineLine.value.textContent = network.online() ? 'online' : 'offline';
          typeLine.value.textContent = network.effectiveType() ?? 'unknown';
        });
      });
    }
  },
  {
    title: 'useLocalStorage',
    tag: 'storage',
    mount(container) {
      const select = element('select');
      const options = ['sunset', 'mint', 'sand'];
      for (const entry of options) {
        const option = element('option');
        option.value = entry;
        option.textContent = entry;
        select.append(option);
      }

      const stateLine = outputLine('theme');
      container.append(select, stateLine.wrap);

      runInRoot(() => {
        const theme = useLocalStorage('fict-hooks-demo-theme', 'sunset');

        select.onchange = () => {
          theme.set(select.value);
        };

        createEffect(() => {
          stateLine.value.textContent = theme.value();
          select.value = theme.value();
        });
      });
    }
  },
  {
    title: 'useClipboard',
    tag: 'clipboard',
    mount(container) {
      const controls = element('div', 'controls');
      const input = element('input');
      input.value = 'Fict hooks are live.';
      const copyBtn = element('button', 'primary');
      copyBtn.textContent = 'copy';
      controls.append(input, copyBtn);

      const copiedLine = outputLine('copied');
      const textLine = outputLine('last text');

      container.append(controls, copiedLine.wrap, textLine.wrap);

      runInRoot(() => {
        const clipboard = useClipboard();

        copyBtn.onclick = () => {
          void clipboard.copy(input.value);
        };

        createEffect(() => {
          copiedLine.value.textContent = clipboard.copied() ? 'yes' : 'no';
          textLine.value.textContent = clipboard.text();
        });
      });
    }
  },
  {
    title: 'useAsyncState',
    tag: 'async',
    mount(container) {
      const controls = element('div', 'controls');
      const input = element('input');
      input.type = 'number';
      input.value = '6';
      const runBtn = element('button', 'primary');
      runBtn.textContent = 'square async';
      controls.append(input, runBtn);

      const loadingLine = outputLine('loading');
      const valueLine = outputLine('result');
      const errorLine = outputLine('error');

      container.append(controls, loadingLine.wrap, valueLine.wrap, errorLine.wrap);

      runInRoot(() => {
        const model = useAsyncState(async (value: number) => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 480);
          });

          if (Number.isNaN(value)) {
            throw new Error('invalid number');
          }

          return value * value;
        }, 0);

        runBtn.onclick = () => {
          const next = Number(input.value);
          void model.execute(next).catch(() => {
            // no-op
          });
        };

        createEffect(() => {
          loadingLine.value.textContent = model.isLoading() ? 'true' : 'false';
          valueLine.value.textContent = String(model.state());
          errorLine.value.textContent =
            model.error() instanceof Error ? model.error().message : '-';
        });
      });
    }
  },
  {
    title: 'useFetch + useRequest',
    tag: 'async',
    mount(container) {
      const controls = element('div', 'controls');
      const fetchBtn = element('button', 'primary');
      fetchBtn.textContent = 'run useFetch';
      const requestBtn = element('button');
      requestBtn.textContent = 'run useRequest';
      controls.append(fetchBtn, requestBtn);

      const fetchLine = outputLine('fetch data');
      const reqLine = outputLine('request data');
      const reqLoading = outputLine('request loading');

      container.append(controls, fetchLine.wrap, reqLine.wrap, reqLoading.wrap);

      runInRoot(() => {
        const fetchModel = useFetch<{ ts: number }>('mock://demo', {
          immediate: false,
          fetch: async () => {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 320);
            });

            return new Response(JSON.stringify({ ts: Date.now() }), {
              status: 200,
              headers: {
                'content-type': 'application/json'
              }
            });
          }
        });

        const requestModel = useRequest(
          async (name: string) => {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 260);
            });
            return `hello ${name} @ ${new Date().toLocaleTimeString()}`;
          },
          {
            manual: true,
            retryCount: 1,
            retryInterval: 200
          }
        );

        fetchBtn.onclick = () => {
          void fetchModel.execute();
        };

        requestBtn.onclick = () => {
          void requestModel.runAsync('fict');
        };

        createEffect(() => {
          fetchLine.value.textContent = JSON.stringify(fetchModel.data() ?? {});
          reqLine.value.textContent = requestModel.data() ?? '-';
          reqLoading.value.textContent = requestModel.loading() ? 'true' : 'false';
        });
      });
    }
  },
  {
    title: 'useVirtualList',
    tag: 'list',
    mount(container) {
      const viewport = element('div', 'virtual-box');
      const inner = element('div', 'virtual-inner');
      viewport.append(inner);

      const rangeLine = outputLine('render range');
      container.append(viewport, rangeLine.wrap);

      runInRoot(() => {
        const data = Array.from({ length: 500 }, (_, index) => `Record #${index + 1}`);

        const list = useVirtualList(data, {
          itemHeight: 28,
          containerHeight: 180,
          overscan: 3
        });

        viewport.addEventListener('scroll', (event) => {
          list.onScroll(event);
        });

        createEffect(() => {
          inner.style.height = `${list.totalHeight()}px`;
          rangeLine.value.textContent = `${list.start()} - ${list.end()}`;

          inner.replaceChildren();
          for (const item of list.list()) {
            const row = element('div', 'virtual-row');
            row.style.top = `${item.start}px`;
            row.textContent = `${item.index}: ${item.data}`;
            inner.append(row);
          }
        });
      });
    }
  }
];

function render(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    return;
  }

  app.append(header());

  const grid = element('section', 'grid');
  app.append(grid);

  for (const card of cards) {
    const box = element('article', 'card');
    const head = element('div', 'card-head');
    const body = element('div', 'card-body');

    const title = element('h2');
    title.textContent = card.title;
    const tag = element('span', 'tag');
    tag.textContent = card.tag;

    head.append(title, tag);
    box.append(head, body);
    grid.append(box);

    card.mount(body);
  }
}

render();

window.addEventListener('beforeunload', () => {
  for (const dispose of disposers) {
    dispose();
  }
});
