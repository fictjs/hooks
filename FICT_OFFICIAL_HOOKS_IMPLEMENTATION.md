# Fict 官方 Hooks 实现文档（v1）

## 1. 目标

本文件用于指导 `@fictjs/hooks` 的官方实现，目标是：

1. 基于 Fict 现有能力（`$state`/`$effect` 编译宏 + runtime signal/lifecycle）提供高价值 hooks。
2. 避免引入 React 风格依赖数组和“为 rerender 而存在”的 API。
3. 对齐 SSR、安全清理、并发与异步取消语义。
4. 保持与编译器的跨模块 hook 返回值推断兼容。

---

## 2. 已完成调研范围

### 2.1 Fict 当前能力（已确认）

- 运行时核心：`createSignal`、`createMemo`、`createEffect`、`batch`、`untrack`。
- 生命周期：`onMount`、`onDestroy`、`onCleanup`、`createRoot`。
- 调度：`startTransition`、`useTransition`、`useDeferredValue`。
- 异步资源：`resource`（含缓存、TTL、SWR、Abort、Suspense token）。
- 上下文：`createContext`、`useContext`、`hasContext`。
- 编译器 Hook 规则：
  - `useX` 只允许组件/Hook 顶层调用（禁止条件/循环/嵌套函数调用）。
  - 支持 hook 返回值元信息（`@fictReturn`、同文件分析、跨模块 metadata）。

### 2.2 3rd-hooks 调研对象

- `react-use`（导出约 107）
- `@react-hookz/web`（导出约 56）
- `ahooks`（导出约 79）
- `vueuse/core`（导出约 143）

并已抽样阅读以下实现族：

- 生命周期：`useMount`/`useUnmount`/`useUpdateEffect`
- 事件：`useEventListener`/`useClickAway`
- 时间控制：`useDebounceFn`/`useThrottleFn`/`useInterval`/`useTimeout`
- 状态：`useCounter`/`useToggle`/`useSetState`/`usePrevious`
- 存储：`useStorage`/`useLocalStorage`/`useSessionStorage`
- 传感器：`useWindowSize`/`useMediaQuery`/`useNetwork`/`useDocumentVisibility`
- 观察器：`useIntersectionObserver`/`useMutationObserver`/`useResizeObserver`
- 异步：`useAsync`/`useAsyncAbortable`/`useAsyncState`/`useFetch`/`useRequest`

---

## 3. 跨框架共性结论

### 3.1 高频稳定能力（四家都反复出现）

1. 事件订阅封装（自动注册/清理、target 兼容）。
2. 浏览器状态 hooks（窗口尺寸、媒体查询、可见性、网络）。
3. 存储 hooks（序列化、错误兜底、同页 + 跨页同步）。
4. 时间函数 hooks（debounce/throttle/interval/timeout）。
5. 常用状态组合（counter/toggle/previous）。

### 3.2 高复杂度能力

1. 通用数据请求层（`ahooks/useRequest`, `vueuse/useFetch`）复杂度显著高于其他 hooks。
2. 插件式请求能力（缓存、轮询、重试、窗口聚焦重刷）是完整子系统，不是“单个 hook”。

### 3.3 React 特有但在 Fict 中价值下降的族

1. `useLatest`/`useMemoizedFn` 大量用于闭包防 stale；Fict 的信号读取模型下价值下降。
2. `useRerender`/`useUpdate` 为组件重执行模型服务；Fict 非主路径。
3. deep/shallow compare effect 依赖数组族，与 Fict“少依赖数组”方向冲突。

---

## 4. Fict 官方 Hooks 选择原则

1. **Fict 原生语义优先**：围绕 signal + lifecycle，而不是 React rerender。
2. **无依赖数组优先**：输入尽量是值/getter，不要求复杂 deps。
3. **SSR 必须有兜底**：`window/document` 不可用时返回稳定初值。
4. **可清理性**：所有副作用必须在 root dispose 时释放。
5. **编译器友好**：`useX` 命名 + `@fictReturn` 元信息，保障跨模块消费。
6. **最小可组合内核**：先做通用 primitives，再叠加高层 hooks。

---

## 5. 最值得优先实现的官方 Hooks

> 分层：P0（首发必须）/ P1（首发后紧跟）/ P2（延后）

## 5.1 P0（首发必须）

### 生命周期与基础副作用

1. `useMount(fn)`
2. `useUnmount(fn)`
3. `useEventListener(target, event, handler, options?)`

### 时间控制

4. `useDebounceFn(fn, wait, options?)`
5. `useThrottleFn(fn, wait, options?)`
6. `useTimeoutFn(fn, delay)`
7. `useIntervalFn(fn, interval)`

### 状态组合

8. `useToggle(initial?)`
9. `useCounter(initial?, { min?, max? })`
10. `usePrevious(value)`

### 浏览器常用能力

11. `useWindowSize(options?)`
12. `useMediaQuery(query, options?)`
13. `useDocumentVisibility(options?)`
14. `useNetwork(options?)`

### 存储

15. `useStorage(key, initial, options?)`
16. `useLocalStorage(key, initial, options?)`
17. `useSessionStorage(key, initial, options?)`

### 交互

18. `useClickOutside(target, handler, options?)`

#### 为什么这些最值得先做

1. 四个生态中重复出现频率最高。
2. 与 Fict runtime 能力一一对应，实现风险低。
3. 直接覆盖业务高频场景（表单、响应式布局、离线提示、偏好持久化、弹层交互）。

## 5.2 P1（首发后紧跟）

1. `useIntersectionObserver`
2. `useResizeObserver`
3. `useMutationObserver`
4. `useClipboard`
5. `useAsyncState`（轻量异步状态，不替代 `resource`）
6. `useRafFn`

## 5.3 P2（延后）

1. `useFetch` 风格 hook（需明确与 `resource` 边界）
2. `useRequest` 风格插件系统（建议独立 package）
3. `useVirtualList`（需结合 Fict list/runtime 特性定制）

---

## 6. 暂不建议纳入首发的 hooks

1. `useRerender` / `useUpdate`

- 依赖 React 的组件重执行模型，和 Fict 模型不一致。

2. `useLatest` / `useMemoizedFn`

- 在 Fict 中可作为内部工具，但不建议对外主推。

3. `useDeepCompareEffect` / `useShallowCompareEffect`

- 强依赖数组语义，与 Fict 的“减少 deps 心智负担”方向冲突。

4. `useRequest` 全量移植

- 体量和维护成本过高，且与 `resource` 存在重叠。

---

## 7. API 设计规范（Fict 官方版）

## 7.1 输入规范

1. 参数尽量支持：`T | (() => T)`。
2. target 参数统一支持：`Element | Window | Document | RefObject | () => target`。
3. 浏览器依赖 API 统一通过 `window/document` 可配置项注入。

## 7.2 返回规范

1. 状态类 hook 返回对象（可读状态 + action）。
2. 纯函数控制类 hook 返回 `{ run, cancel, flush, pending? }`。
3. 观察器类 hook 返回 `{ stop, isSupported, ... }`。

## 7.3 SSR 规范

1. 不可用 API 下不抛错，返回稳定默认值。
2. 若需要首屏无水合偏差，提供 `initial*` 选项。

---

## 8. 编译器与跨模块响应式返回值要求

这是官方 hooks 成败关键项。

## 8.1 问题

Fict 对跨模块 `useX` 返回值的响应式解包依赖 metadata。没有 metadata 时，`const { count } = useCounter()` 可能退化为静态快照语义。

## 8.2 方案

1. 所有导出的 `useX` 使用 `@fictReturn` 注释，明确哪些字段是 `signal/memo`。
2. hooks 包构建产物必须输出可被编译器读取的模块 metadata。
3. `@fictjs/vite-plugin` 需要确保 bare import（如 `@fictjs/hooks`）也能解析 metadata，不仅是相对路径模块。

## 8.3 约束建议

1. 首发阶段，响应式字段尽量固定对象结构，降低 metadata 推断复杂度。
2. 对外文档明确“在 Fict 编译链中获得无 `()` 体验；非编译场景使用 accessor 形式”。

---

## 9. 建议目录结构

```text
src/
  index.ts
  lifecycle/
    useMount.ts
    useUnmount.ts
  event/
    useEventListener.ts
    useClickOutside.ts
  timing/
    useDebounceFn.ts
    useThrottleFn.ts
    useTimeoutFn.ts
    useIntervalFn.ts
  state/
    useToggle.ts
    useCounter.ts
    usePrevious.ts
  browser/
    useWindowSize.ts
    useMediaQuery.ts
    useDocumentVisibility.ts
    useNetwork.ts
  storage/
    useStorage.ts
    useLocalStorage.ts
    useSessionStorage.ts
  observer/
    useIntersectionObserver.ts
    useResizeObserver.ts
    useMutationObserver.ts
  internal/
    env.ts
    target.ts
    event.ts
    scheduler.ts
    storage.ts
```

---

## 10. 关键实现策略（按模块）

## 10.1 useEventListener

1. 内部统一 `resolveTarget`。
2. handler 通过稳定包装层调用最新函数引用。
3. 支持 event 数组。
4. `onDestroy` 自动解绑。

## 10.2 useDebounceFn / useThrottleFn

1. 复用统一 filter-wrapper。
2. 提供 `run/cancel/flush`。
3. 销毁时自动 cancel。
4. 默认参数对齐主流库：`trailing/leading/maxWait`。

## 10.3 useStorage

1. 序列化器策略：`json/string/number/boolean/date/map/set/custom`。
2. 同标签页同步：自定义事件。
3. 跨标签页同步：`storage` 事件。
4. 防回环：写入前值比较 + pause/resume 机制。
5. 错误全部走 `onError`。

## 10.4 useWindowSize / useMediaQuery / useNetwork / useDocumentVisibility

1. 首次同步读取当前值。
2. SSR fallback 值可配置。
3. `passive: true` 默认。
4. 所有监听器销毁时自动清理。

## 10.5 useClickOutside

1. 支持 ignore 列表（selector/element/ref）。
2. 支持 pointerdown + click 双阶段，避免误触。
3. 可选 `controls`（stop/cancel/trigger）。

---

## 11. 测试策略

## 11.1 单元测试（Vitest + jsdom）

1. 生命周期是否正确清理。
2. 事件监听是否重复注册、是否正确移除。
3. debounce/throttle 行为（leading/trailing/maxWait/cancel/flush）。
4. storage 同页与跨页同步。
5. 观察器 hook 在 unsupported 环境行为。
6. SSR 环境（无 window/document）回退行为。

## 11.2 编译链测试（关键）

1. `useX` 返回对象/数组/直接 accessor 的 metadata 识别。
2. 从独立包导入 hooks 时的 metadata 解析。
3. 解构后在 JSX 与 effect 中是否保持响应式。

## 11.3 类型测试

1. TS 推断（返回值、actions、泛型 storage）。
2. 可选参数与重载稳定性。

---

## 12. 分阶段落地计划

## Phase 1（P0-1）

1. `useEventListener`
2. `useMount` / `useUnmount`
3. `useToggle` / `useCounter` / `usePrevious`
4. `useTimeoutFn` / `useIntervalFn`
5. 基础内部工具（env/target）

**验收**：40+ 用例，SSR 测试通过。

## Phase 2（P0-2）

1. `useDebounceFn` / `useThrottleFn`
2. `useWindowSize` / `useMediaQuery` / `useDocumentVisibility` / `useNetwork`
3. `useClickOutside`

**验收**：行为和 react-hookz/vueuse 对齐，边界测试通过。

## Phase 3（P0-3）

1. `useStorage` / `useLocalStorage` / `useSessionStorage`
2. metadata + 跨模块响应式解构 E2E

**验收**：同页/跨页同步，序列化策略，metadata E2E 全通过。

## Phase 4（P1）

1. observer 系 hooks
2. `useAsyncState`

---

## 13. 与现有 Fict API 的边界约定

1. `resource` 仍是官方异步数据主路径（缓存/失效/Suspense）。
2. hooks 包优先提供轻量交互层，不重复实现完整请求平台。
3. `useTransition/useDeferredValue` 直接复用 runtime 现有实现，不再重复包装。

---

## 14. 首批建议导出列表（最终版）

```ts
export {
  useMount,
  useUnmount,
  useEventListener,
  useClickOutside,
  useDebounceFn,
  useThrottleFn,
  useTimeoutFn,
  useIntervalFn,
  useToggle,
  useCounter,
  usePrevious,
  useWindowSize,
  useMediaQuery,
  useDocumentVisibility,
  useNetwork,
  useStorage,
  useLocalStorage,
  useSessionStorage
} from './...';
```

---

## 15. 结论

在 Fict 现阶段，最值得官方化的 hooks 不是“React Hooks 全量镜像”，而是：

1. 与 Fict 运行时强匹配、无需 rerender 心智的浏览器与副作用 primitives。
2. 高频业务场景的稳定封装（事件、时间控制、存储、环境状态、基础状态机）。
3. 与编译器 metadata 协同，保证跨模块 `useX` 的响应式可用性。

这个路线可以在低风险下快速形成 Fict 官方 hooks 的可用核心，并为后续 `observer/async/request` 扩展留出清晰边界。
