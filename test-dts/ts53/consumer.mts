import { useAsyncState, useRequest } from '@fictjs/hooks';

const asyncState = useAsyncState(async (count: number) => count * 2, 0, {
  immediate: true,
  immediateArgs: [2]
});
asyncState.execute(3);
// @ts-expect-error executor argument types remain intact for legacy consumers
asyncState.execute('3');
useAsyncState(async (count: number) => count * 2, 0, {
  immediate: true,
  // @ts-expect-error immediate arguments cannot override executor inference
  immediateArgs: ['2']
});

const request = useRequest(async (name: string) => name.length, { manual: true });
request.run('fict');
// @ts-expect-error service parameter types remain intact for legacy consumers
request.run(1);

// @ts-expect-error required service parameters cannot infer an unsafe automatic call
useRequest(async (name: string) => name, {});
useRequest(async (name: string) => name, {
  // @ts-expect-error default parameters cannot override service inference
  defaultParams: [1]
});
