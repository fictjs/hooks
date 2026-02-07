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
  useIntersectionObserver,
  useLocalStorage,
  useMediaQuery,
  useMount,
  useMutationObserver,
  useNetwork,
  usePrevious,
  useRafFn,
  useRequest,
  useResizeObserver,
  useSessionStorage,
  useStorage,
  useThrottleFn,
  useTimeoutFn,
  useToggle,
  useUnmount,
  useVirtualList,
  useWindowSize
} from '../../src/index';

type Dispose = () => void;

type DemoMount = (container: HTMLElement, runtime: DemoRuntime) => void;

interface HookEntry {
  id: string;
  name: string;
  category: string;
  summary: string;
  docPath: string;
  code: string;
  mount: DemoMount;
}

class DemoRuntime {
  private disposers: Dispose[] = [];

  runInRoot(setup: () => void): void {
    const { dispose } = createRoot(setup);
    this.disposers.push(dispose);
  }

  register(dispose: Dispose): void {
    this.disposers.push(dispose);
  }

  disposeAll(): void {
    for (let index = this.disposers.length - 1; index >= 0; index -= 1) {
      this.disposers[index]?.();
    }
    this.disposers = [];
  }
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
  const wrap = element('div', 'demo-line mono');
  const key = element('span');
  key.className = 'label';
  key.textContent = `${label}: `;
  const value = element('span');
  wrap.append(key, value);
  return { wrap, value };
}

function button(label: string, isPrimary = false): HTMLButtonElement {
  const node = element('button', isPrimary ? 'primary' : undefined);
  node.textContent = label;
  return node;
}

function createCatalog(): HookEntry[] {
  const data = Array.from({ length: 300 }, (_, index) => `row-${index}`);

  return [
    {
      id: 'useMount',
      name: 'useMount',
      category: 'lifecycle',
      summary: 'Run logic after the current root mounts.',
      docPath: 'docs/hooks/useMount.md',
      code: "useMount(() => console.log('mounted'))",
      mount(container, runtime) {
        const mountLine = outputLine('mounted count');
        const controls = element('div', 'controls');
        const runBtn = button('mount child root', true);

        controls.append(runBtn);
        container.append(controls, mountLine.wrap);

        runtime.runInRoot(() => {
          const mounted = createSignal(0);

          runBtn.onclick = () => {
            const child = createRoot(() => {
              useMount(() => {
                mounted(mounted() + 1);
              });
            });
            child.dispose();
          };

          createEffect(() => {
            mountLine.value.textContent = String(mounted());
          });
        });
      }
    },
    {
      id: 'useUnmount',
      name: 'useUnmount',
      category: 'lifecycle',
      summary: 'Register cleanup logic for root disposal.',
      docPath: 'docs/hooks/useUnmount.md',
      code: "useUnmount(() => console.log('disposed'))",
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const mountBtn = button('create child root', true);
        const disposeBtn = button('dispose child root');
        const line = outputLine('unmount count');

        controls.append(mountBtn, disposeBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const unmounted = createSignal(0);
          let childDispose: Dispose | undefined;

          mountBtn.onclick = () => {
            childDispose?.();
            const child = createRoot(() => {
              useUnmount(() => {
                unmounted(unmounted() + 1);
              });
            });
            childDispose = child.dispose;
          };

          disposeBtn.onclick = () => {
            childDispose?.();
            childDispose = undefined;
          };

          runtime.register(() => {
            childDispose?.();
          });

          createEffect(() => {
            line.value.textContent = String(unmounted());
          });
        });
      }
    },
    {
      id: 'useEventListener',
      name: 'useEventListener',
      category: 'event',
      summary: 'Bind listeners with start/stop controls and auto cleanup.',
      docPath: 'docs/hooks/useEventListener.md',
      code: "useEventListener(window, 'resize', handler)",
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const startBtn = button('start', true);
        const stopBtn = button('stop');
        const line = outputLine('pointerdown count');

        controls.append(startBtn, stopBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const count = createSignal(0);
          const listener = useEventListener(
            window,
            'pointerdown',
            () => {
              count(count() + 1);
            },
            { immediate: false }
          );

          startBtn.onclick = listener.start;
          stopBtn.onclick = listener.stop;

          createEffect(() => {
            line.value.textContent = String(count());
          });
        });
      }
    },
    {
      id: 'useClickOutside',
      name: 'useClickOutside',
      category: 'event',
      summary: 'Trigger when pointer interaction happens outside target element.',
      docPath: 'docs/hooks/useClickOutside.md',
      code: 'useClickOutside(panelRef, closePanel)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const toggleBtn = button('toggle panel', true);
        const panel = element('div', 'output');
        panel.textContent = 'panel area: click outside this card to close';
        const line = outputLine('panel open');

        controls.append(toggleBtn);
        container.append(controls, panel, line.wrap);

        runtime.runInRoot(() => {
          const open = createSignal(true);
          const panelRef = { current: panel as Element };

          useClickOutside(
            panelRef,
            () => {
              open(false);
            },
            { ignore: [toggleBtn] }
          );

          toggleBtn.onclick = () => {
            open(!open());
          };

          createEffect(() => {
            panel.style.display = open() ? 'block' : 'none';
            line.value.textContent = open() ? 'yes' : 'no';
          });
        });
      }
    },
    {
      id: 'useDebounceFn',
      name: 'useDebounceFn',
      category: 'timing',
      summary: 'Debounce function calls with run/cancel/flush controls.',
      docPath: 'docs/hooks/useDebounceFn.md',
      code: 'const debounced = useDebounceFn(fn, 300)',
      mount(container, runtime) {
        const input = element('input');
        input.placeholder = 'type quickly';
        const line = outputLine('debounced value');

        container.append(input, line.wrap);

        runtime.runInRoot(() => {
          const value = createSignal('');
          const debounced = useDebounceFn((next: string) => {
            value(next);
          }, 350);

          input.oninput = () => {
            debounced.run(input.value);
          };

          createEffect(() => {
            line.value.textContent = value();
          });
        });
      }
    },
    {
      id: 'useThrottleFn',
      name: 'useThrottleFn',
      category: 'timing',
      summary: 'Throttle high-frequency events.',
      docPath: 'docs/hooks/useThrottleFn.md',
      code: 'const throttled = useThrottleFn(fn, 200)',
      mount(container, runtime) {
        const input = element('input');
        input.placeholder = 'type fast';
        const line = outputLine('throttle hits');

        container.append(input, line.wrap);

        runtime.runInRoot(() => {
          const hits = createSignal(0);
          const throttled = useThrottleFn(() => {
            hits(hits() + 1);
          }, 400);

          input.oninput = () => {
            throttled.run();
          };

          createEffect(() => {
            line.value.textContent = String(hits());
          });
        });
      }
    },
    {
      id: 'useTimeoutFn',
      name: 'useTimeoutFn',
      category: 'timing',
      summary: 'Timeout with restart/cancel controls.',
      docPath: 'docs/hooks/useTimeoutFn.md',
      code: 'const timeout = useTimeoutFn(fn, 1000)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const restartBtn = button('restart timeout', true);
        const cancelBtn = button('cancel');
        const line = outputLine('fires');

        controls.append(restartBtn, cancelBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const fired = createSignal(0);
          const timeout = useTimeoutFn(() => {
            fired(fired() + 1);
          }, 1200);

          restartBtn.onclick = timeout.run;
          cancelBtn.onclick = timeout.cancel;

          createEffect(() => {
            line.value.textContent = `${fired()} (pending: ${timeout.pending() ? 'yes' : 'no'})`;
          });
        });
      }
    },
    {
      id: 'useIntervalFn',
      name: 'useIntervalFn',
      category: 'timing',
      summary: 'Managed interval with pause/resume.',
      docPath: 'docs/hooks/useIntervalFn.md',
      code: 'const interval = useIntervalFn(fn, 1000)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const startBtn = button('resume', true);
        const stopBtn = button('pause');
        const line = outputLine('ticks');

        controls.append(startBtn, stopBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const ticks = createSignal(0);
          const interval = useIntervalFn(() => {
            ticks(ticks() + 1);
          }, 900);

          startBtn.onclick = interval.run;
          stopBtn.onclick = interval.cancel;

          createEffect(() => {
            line.value.textContent = String(ticks());
          });
        });
      }
    },
    {
      id: 'useRafFn',
      name: 'useRafFn',
      category: 'timing',
      summary: 'requestAnimationFrame loop helper.',
      docPath: 'docs/hooks/useRafFn.md',
      code: 'const raf = useRafFn((delta) => {})',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const startBtn = button('start', true);
        const stopBtn = button('stop');
        const line = outputLine('frames');

        controls.append(startBtn, stopBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
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
      id: 'useToggle',
      name: 'useToggle',
      category: 'state',
      summary: 'Boolean state helper.',
      docPath: 'docs/hooks/useToggle.md',
      code: 'const toggle = useToggle(false)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const toggleBtn = button('toggle', true);
        const onBtn = button('set true');
        const offBtn = button('set false');
        const line = outputLine('value');

        controls.append(toggleBtn, onBtn, offBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const model = useToggle(false);

          toggleBtn.onclick = model.toggle;
          onBtn.onclick = model.setTrue;
          offBtn.onclick = model.setFalse;

          createEffect(() => {
            line.value.textContent = model.value() ? 'true' : 'false';
          });
        });
      }
    },
    {
      id: 'useCounter',
      name: 'useCounter',
      category: 'state',
      summary: 'Counter with min/max clamping.',
      docPath: 'docs/hooks/useCounter.md',
      code: 'const counter = useCounter(0, { min: 0, max: 10 })',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const incBtn = button('+1', true);
        const decBtn = button('-1');
        const resetBtn = button('reset');
        const line = outputLine('count');

        controls.append(incBtn, decBtn, resetBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const counter = useCounter(3, { min: 0, max: 10 });

          incBtn.onclick = () => counter.inc();
          decBtn.onclick = () => counter.dec();
          resetBtn.onclick = counter.reset;

          createEffect(() => {
            line.value.textContent = String(counter.count());
          });
        });
      }
    },
    {
      id: 'usePrevious',
      name: 'usePrevious',
      category: 'state',
      summary: 'Track previous value of a source.',
      docPath: 'docs/hooks/usePrevious.md',
      code: 'const prev = usePrevious(() => value())',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const input = element('input');
        input.type = 'number';
        input.value = '1';
        controls.append(input);

        const currentLine = outputLine('current');
        const prevLine = outputLine('previous');

        container.append(controls, currentLine.wrap, prevLine.wrap);

        runtime.runInRoot(() => {
          const value = createSignal(1);
          const previous = usePrevious(() => value());

          input.oninput = () => {
            value(Number(input.value));
          };

          createEffect(() => {
            currentLine.value.textContent = String(value());
            prevLine.value.textContent = previous() == null ? '-' : String(previous());
          });
        });
      }
    },
    {
      id: 'useVirtualList',
      name: 'useVirtualList',
      category: 'state',
      summary: 'Virtualize fixed-height lists for large datasets.',
      docPath: 'docs/hooks/useVirtualList.md',
      code: 'const virtual = useVirtualList(items, { itemHeight, containerHeight })',
      mount(container, runtime) {
        const viewport = element('div', 'virtual-box');
        const inner = element('div', 'virtual-inner');
        const line = outputLine('range');

        viewport.append(inner);
        container.append(viewport, line.wrap);

        runtime.runInRoot(() => {
          const list = useVirtualList(data, {
            itemHeight: 28,
            containerHeight: 190,
            overscan: 2
          });

          viewport.addEventListener('scroll', (event) => {
            list.onScroll(event);
          });

          createEffect(() => {
            inner.style.height = `${list.totalHeight()}px`;
            line.value.textContent = `${list.start()}-${list.end()}`;

            inner.replaceChildren();
            for (const item of list.list()) {
              const row = element('div', 'virtual-row mono');
              row.style.top = `${item.start}px`;
              row.textContent = `${item.index}: ${item.data}`;
              inner.append(row);
            }
          });
        });
      }
    },
    {
      id: 'useWindowSize',
      name: 'useWindowSize',
      category: 'browser',
      summary: 'Reactive window width/height state.',
      docPath: 'docs/hooks/useWindowSize.md',
      code: 'const { width, height } = useWindowSize()',
      mount(container, runtime) {
        const line = outputLine('window');
        container.append(line.wrap);

        runtime.runInRoot(() => {
          const model = useWindowSize();

          createEffect(() => {
            line.value.textContent = `${model.width()} x ${model.height()}`;
          });
        });
      }
    },
    {
      id: 'useMediaQuery',
      name: 'useMediaQuery',
      category: 'browser',
      summary: 'Track media query matching state.',
      docPath: 'docs/hooks/useMediaQuery.md',
      code: "const mq = useMediaQuery('(max-width: 760px)')",
      mount(container, runtime) {
        const line = outputLine('matches');
        const note = element('div', 'hint');
        note.textContent = 'Resize viewport to flip this value.';
        container.append(line.wrap, note);

        runtime.runInRoot(() => {
          const query = useMediaQuery('(max-width: 760px)');
          createEffect(() => {
            line.value.textContent = query.matches() ? 'true' : 'false';
          });
        });
      }
    },
    {
      id: 'useDocumentVisibility',
      name: 'useDocumentVisibility',
      category: 'browser',
      summary: 'Expose document visibility state.',
      docPath: 'docs/hooks/useDocumentVisibility.md',
      code: 'const visibility = useDocumentVisibility()',
      mount(container, runtime) {
        const visibilityLine = outputLine('visibility');
        const hiddenLine = outputLine('hidden');

        container.append(visibilityLine.wrap, hiddenLine.wrap);

        runtime.runInRoot(() => {
          const visibility = useDocumentVisibility();

          createEffect(() => {
            visibilityLine.value.textContent = visibility.visibility();
            hiddenLine.value.textContent = visibility.hidden() ? 'true' : 'false';
          });
        });
      }
    },
    {
      id: 'useNetwork',
      name: 'useNetwork',
      category: 'browser',
      summary: 'Read online status and connection details.',
      docPath: 'docs/hooks/useNetwork.md',
      code: 'const net = useNetwork()',
      mount(container, runtime) {
        const onlineLine = outputLine('online');
        const typeLine = outputLine('effectiveType');
        const downlinkLine = outputLine('downlink');

        container.append(onlineLine.wrap, typeLine.wrap, downlinkLine.wrap);

        runtime.runInRoot(() => {
          const network = useNetwork();

          createEffect(() => {
            onlineLine.value.textContent = network.online() ? 'online' : 'offline';
            typeLine.value.textContent = network.effectiveType() ?? 'unknown';
            downlinkLine.value.textContent =
              network.downlink() == null ? '-' : String(network.downlink());
          });
        });
      }
    },
    {
      id: 'useStorage',
      name: 'useStorage',
      category: 'storage',
      summary: 'Generic storage state with serializer support.',
      docPath: 'docs/hooks/useStorage.md',
      code: "const state = useStorage('key', 'value', { storage: localStorage })",
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const input = element('input');
        input.placeholder = 'text';
        const saveBtn = button('save', true);
        const clearBtn = button('remove');
        const line = outputLine('value');

        controls.append(input, saveBtn, clearBtn);
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const state = useStorage('fict-demo-storage', 'seed', { storage: localStorage, window });

          saveBtn.onclick = () => {
            state.set(input.value);
          };
          clearBtn.onclick = state.remove;

          createEffect(() => {
            line.value.textContent = state.value();
            input.value = state.value();
          });
        });
      }
    },
    {
      id: 'useLocalStorage',
      name: 'useLocalStorage',
      category: 'storage',
      summary: 'localStorage convenience wrapper.',
      docPath: 'docs/hooks/useLocalStorage.md',
      code: "const theme = useLocalStorage('theme', 'sunset')",
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const select = element('select');
        for (const name of ['sunset', 'mint', 'sand']) {
          const option = element('option');
          option.value = name;
          option.textContent = name;
          select.append(option);
        }
        controls.append(select);

        const line = outputLine('theme');
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const theme = useLocalStorage('fict-demo-theme', 'sunset');

          select.onchange = () => {
            theme.set(select.value);
          };

          createEffect(() => {
            line.value.textContent = theme.value();
            select.value = theme.value();
          });
        });
      }
    },
    {
      id: 'useSessionStorage',
      name: 'useSessionStorage',
      category: 'storage',
      summary: 'sessionStorage convenience wrapper.',
      docPath: 'docs/hooks/useSessionStorage.md',
      code: "const token = useSessionStorage('token', 'guest')",
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const input = element('input');
        const saveBtn = button('save', true);
        controls.append(input, saveBtn);

        const line = outputLine('session value');
        container.append(controls, line.wrap);

        runtime.runInRoot(() => {
          const token = useSessionStorage('fict-demo-session', 'guest');

          saveBtn.onclick = () => {
            token.set(input.value || 'guest');
          };

          createEffect(() => {
            line.value.textContent = token.value();
            input.value = token.value();
          });
        });
      }
    },
    {
      id: 'useIntersectionObserver',
      name: 'useIntersectionObserver',
      category: 'observer',
      summary: 'Observe target intersection changes.',
      docPath: 'docs/hooks/useIntersectionObserver.md',
      code: 'useIntersectionObserver(target, callback)',
      mount(container, runtime) {
        const viewport = element('div', 'scroll-box');
        const spacer = element('div');
        spacer.style.height = '220px';
        const target = element('div', 'target-chip');
        target.textContent = 'target';
        const tail = element('div');
        tail.style.height = '220px';

        viewport.append(spacer, target, tail);

        const supportLine = outputLine('supported');
        const entryLine = outputLine('isIntersecting');

        container.append(viewport, supportLine.wrap, entryLine.wrap);

        runtime.runInRoot(() => {
          const intersecting = createSignal('unknown');
          const observer = useIntersectionObserver(target, (entries) => {
            const first = entries[0];
            intersecting(first?.isIntersecting ? 'true' : 'false');
          });

          createEffect(() => {
            supportLine.value.textContent = observer.isSupported() ? 'yes' : 'no';
            entryLine.value.textContent = intersecting();
          });
        });
      }
    },
    {
      id: 'useResizeObserver',
      name: 'useResizeObserver',
      category: 'observer',
      summary: 'Observe element size changes.',
      docPath: 'docs/hooks/useResizeObserver.md',
      code: 'useResizeObserver(target, callback)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const slider = element('input');
        slider.type = 'range';
        slider.min = '120';
        slider.max = '320';
        slider.value = '180';

        const box = element('div', 'resize-box');
        box.style.width = '180px';

        controls.append(slider);

        const line = outputLine('width');
        container.append(controls, box, line.wrap);

        runtime.runInRoot(() => {
          const width = createSignal(180);
          useResizeObserver(box, (entries) => {
            width(Math.round(entries[0]?.contentRect.width ?? 0));
          });

          slider.oninput = () => {
            box.style.width = `${slider.value}px`;
          };

          createEffect(() => {
            line.value.textContent = `${width()}px`;
          });
        });
      }
    },
    {
      id: 'useMutationObserver',
      name: 'useMutationObserver',
      category: 'observer',
      summary: 'Observe DOM mutations for target subtree.',
      docPath: 'docs/hooks/useMutationObserver.md',
      code: 'useMutationObserver(target, callback, { childList: true })',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const addBtn = button('append node', true);
        const list = element('div', 'mut-list');
        const countLine = outputLine('mutation records');

        controls.append(addBtn);
        container.append(controls, list, countLine.wrap);

        runtime.runInRoot(() => {
          const records = createSignal(0);
          let index = 0;

          useMutationObserver(list, (entries) => {
            records(records() + entries.length);
          });

          addBtn.onclick = () => {
            const node = element('div', 'mut-item');
            node.textContent = `item-${index}`;
            index += 1;
            list.append(node);
          };

          createEffect(() => {
            countLine.value.textContent = String(records());
          });
        });
      }
    },
    {
      id: 'useClipboard',
      name: 'useClipboard',
      category: 'clipboard',
      summary: 'Copy text with reactive copy status.',
      docPath: 'docs/hooks/useClipboard.md',
      code: 'const clipboard = useClipboard(); await clipboard.copy(text)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const input = element('input');
        input.value = 'fict hooks demo';
        const copyBtn = button('copy', true);

        controls.append(input, copyBtn);

        const copiedLine = outputLine('copied');
        const textLine = outputLine('text');

        container.append(controls, copiedLine.wrap, textLine.wrap);

        runtime.runInRoot(() => {
          const clipboard = useClipboard();

          copyBtn.onclick = () => {
            void clipboard.copy(input.value);
          };

          createEffect(() => {
            copiedLine.value.textContent = clipboard.copied() ? 'yes' : 'no';
            textLine.value.textContent = clipboard.text() || '-';
          });
        });
      }
    },
    {
      id: 'useAsyncState',
      name: 'useAsyncState',
      category: 'async',
      summary: 'Async state manager with loading/error/data signals.',
      docPath: 'docs/hooks/useAsyncState.md',
      code: 'const model = useAsyncState(asyncFn, initial)',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const input = element('input');
        input.type = 'number';
        input.value = '4';
        const runBtn = button('square', true);

        controls.append(input, runBtn);

        const loadLine = outputLine('loading');
        const valueLine = outputLine('value');
        const errLine = outputLine('error');

        container.append(controls, loadLine.wrap, valueLine.wrap, errLine.wrap);

        runtime.runInRoot(() => {
          const model = useAsyncState(async (value: number) => {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 420);
            });

            if (Number.isNaN(value)) {
              throw new Error('invalid input');
            }

            return value * value;
          }, 0);

          runBtn.onclick = () => {
            void model.execute(Number(input.value)).catch(() => {
              // no-op
            });
          };

          createEffect(() => {
            loadLine.value.textContent = model.isLoading() ? 'true' : 'false';
            valueLine.value.textContent = String(model.state());
            errLine.value.textContent =
              model.error() instanceof Error ? model.error().message : '-';
          });
        });
      }
    },
    {
      id: 'useFetch',
      name: 'useFetch',
      category: 'async',
      summary: 'Fetch helper with abort/loading/data state.',
      docPath: 'docs/hooks/useFetch.md',
      code: 'const fetchState = useFetch(url, { immediate: false })',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const runBtn = button('run fetch', true);
        const abortBtn = button('abort');

        controls.append(runBtn, abortBtn);

        const dataLine = outputLine('data');
        const loadingLine = outputLine('loading');
        const statusLine = outputLine('status');

        container.append(controls, dataLine.wrap, loadingLine.wrap, statusLine.wrap);

        runtime.runInRoot(() => {
          const model = useFetch<{ at: number }>('mock://fetch', {
            immediate: false,
            fetch: async () => {
              await new Promise<void>((resolve) => {
                setTimeout(resolve, 500);
              });
              return new Response(JSON.stringify({ at: Date.now() }), {
                status: 200,
                headers: { 'content-type': 'application/json' }
              });
            }
          });

          runBtn.onclick = () => {
            void model.execute();
          };

          abortBtn.onclick = model.abort;

          createEffect(() => {
            dataLine.value.textContent = JSON.stringify(model.data() ?? {});
            loadingLine.value.textContent = model.isLoading() ? 'true' : 'false';
            statusLine.value.textContent = model.status() == null ? '-' : String(model.status());
          });
        });
      }
    },
    {
      id: 'useRequest',
      name: 'useRequest',
      category: 'async',
      summary: 'Request manager with retry/cache/refresh/mutate.',
      docPath: 'docs/hooks/useRequest.md',
      code: 'const req = useRequest(service, { manual: true })',
      mount(container, runtime) {
        const controls = element('div', 'controls');
        const runBtn = button('run request', true);
        const refreshBtn = button('refresh');

        controls.append(runBtn, refreshBtn);

        const dataLine = outputLine('data');
        const loadingLine = outputLine('loading');

        container.append(controls, dataLine.wrap, loadingLine.wrap);

        runtime.runInRoot(() => {
          const req = useRequest(
            async (name: string) => {
              await new Promise<void>((resolve) => {
                setTimeout(resolve, 350);
              });
              return `hello ${name} at ${new Date().toLocaleTimeString()}`;
            },
            {
              manual: true,
              retryCount: 1,
              retryInterval: 200,
              cacheKey: 'playground-request'
            }
          );

          runBtn.onclick = () => {
            req.run('fict');
          };

          refreshBtn.onclick = () => {
            void req.refresh();
          };

          createEffect(() => {
            dataLine.value.textContent = req.data() ?? '-';
            loadingLine.value.textContent = req.loading() ? 'true' : 'false';
          });
        });
      }
    }
  ];
}

const hooks = createCatalog();
const byId = new Map(hooks.map((entry) => [entry.id, entry]));

function resolveCurrentId(): string {
  const raw = window.location.hash.replace('#', '');
  if (byId.has(raw)) {
    return raw;
  }
  return hooks[0]!.id;
}

function renderApp(): void {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    return;
  }

  app.innerHTML = '';

  const hero = element('header', 'hero');
  const title = element('h1');
  title.textContent = 'Fict Hooks Demo Website';
  const desc = element('p');
  desc.innerHTML =
    'One hook per page with live interaction. Use the left navigation or search to jump quickly.';
  hero.append(title, desc);

  const layout = element('div', 'layout');
  const sidebar = element('aside', 'sidebar');
  const search = element('input', 'search');
  search.placeholder = 'search hook...';
  sidebar.append(search);

  const nav = element('nav', 'nav');
  sidebar.append(nav);

  const main = element('main', 'main');
  const panel = element('section', 'panel');
  const head = element('div', 'panel-head');
  const badge = element('span', 'badge');
  const hookName = element('h2');
  const summary = element('p', 'summary');
  const doc = element('p', 'doc mono');
  const code = element('pre', 'code');
  const codeInner = element('code');
  code.append(codeInner);

  const demo = element('div', 'demo');
  head.append(badge, hookName, summary, doc);
  panel.append(head, code, demo);
  main.append(panel);

  layout.append(sidebar, main);
  app.append(hero, layout);

  let currentRuntime: DemoRuntime | undefined;

  const selectedId = createSignal(resolveCurrentId());
  const query = createSignal('');

  const renderNav = () => {
    nav.replaceChildren();

    const normalized = query().trim().toLowerCase();
    const groups = new Map<string, HookEntry[]>();

    for (const entry of hooks) {
      const matched =
        normalized.length === 0 ||
        entry.name.toLowerCase().includes(normalized) ||
        entry.summary.toLowerCase().includes(normalized);

      if (!matched) {
        continue;
      }

      const list = groups.get(entry.category) ?? [];
      list.push(entry);
      groups.set(entry.category, list);
    }

    for (const [category, list] of groups.entries()) {
      const group = element('section', 'nav-group');
      const groupTitle = element('h3');
      groupTitle.textContent = category;
      group.append(groupTitle);

      for (const entry of list) {
        const item = element('button', 'nav-item');
        if (entry.id === selectedId()) {
          item.classList.add('active');
        }
        item.textContent = entry.name;
        item.onclick = () => {
          window.location.hash = entry.id;
        };
        group.append(item);
      }

      nav.append(group);
    }
  };

  const renderPanel = () => {
    const entry = byId.get(selectedId()) ?? hooks[0]!;

    currentRuntime?.disposeAll();
    currentRuntime = new DemoRuntime();
    demo.replaceChildren();

    badge.textContent = entry.category;
    hookName.textContent = entry.name;
    summary.textContent = entry.summary;
    doc.textContent = entry.docPath;
    codeInner.textContent = entry.code;

    entry.mount(demo, currentRuntime);
  };

  search.oninput = () => {
    query(search.value);
    renderNav();
  };

  window.addEventListener('hashchange', () => {
    selectedId(resolveCurrentId());
    renderNav();
    renderPanel();
  });

  renderNav();
  renderPanel();

  window.addEventListener('beforeunload', () => {
    currentRuntime?.disposeAll();
  });
}

renderApp();
