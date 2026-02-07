import { describe, expect, it } from 'vitest';
import * as hooks from '../src/index';

describe('package smoke', () => {
  it('loads the module', () => {
    expect(hooks).toBeTypeOf('object');
  });
});
