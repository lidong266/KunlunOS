import { describe, it, expect } from 'vitest';
import {
  TRYTE_MAX,
  TRYTE_ZERO,
  TRYTE_MIN,
  tryteToValue,
  valueToTryte,
  isValidTryte,
  tryteAdd,
  tryteWeightedSum,
  tryteDotProduct,
  tryteCertainty,
  tryteDominantDirection,
  tryteMerge,
} from '../src/tryte.js';

describe('Tryte constants', () => {
  it('TRYTE_MAX = [1,1,1,1,1,1]', () => {
    expect(TRYTE_MAX).toEqual([1, 1, 1, 1, 1, 1]);
  });
  it('TRYTE_ZERO = [0,0,0,0,0,0]', () => {
    expect(TRYTE_ZERO).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('TRYTE_MIN = [-1,-1,-1,-1,-1,-1]', () => {
    expect(TRYTE_MIN).toEqual([-1, -1, -1, -1, -1, -1]);
  });
});

describe('tryteToValue / valueToTryte — 729 级双向转换', () => {
  it('TRYTE_MIN → 0', () => {
    expect(tryteToValue(TRYTE_MIN)).toBe(0);
  });
  it('TRYTE_ZERO → 364', () => {
    expect(tryteToValue(TRYTE_ZERO)).toBe(364);
  });
  it('TRYTE_MAX → 728', () => {
    expect(tryteToValue(TRYTE_MAX)).toBe(728);
  });
  it('valueToTryte 是 tryteToValue 的逆映射', () => {
    for (const v of [0, 1, 100, 200, 300, 364, 500, 600, 700, 728]) {
      expect(tryteToValue(valueToTryte(v))).toBe(v);
    }
  });
  it('边界：0 ↔ TRYTE_MIN', () => {
    expect(valueToTryte(0)).toEqual(TRYTE_MIN);
  });
});

describe('isValidTryte', () => {
  it('valid: TRYTE_MAX', () => { expect(isValidTryte(TRYTE_MAX)).toBe(true); });
  it('invalid: [2,0,0,0,0,0]', () => { expect(isValidTryte([2, 0, 0, 0, 0, 0])).toBe(false); });
  it('invalid: too short', () => { expect(isValidTryte([1, 0, -1])).toBe(false); });
  it('invalid: too long', () => { expect(isValidTryte([1, 0, -1, 0, 1, -1, 0])).toBe(false); });
  it('invalid: not array', () => { expect(isValidTryte('not array')).toBe(false); });
});

describe('tryteAdd', () => {
  it('TRYTE_MAX + TRYTE_MIN = [0,0,0,0,0,0]', () => {
    expect(tryteAdd(TRYTE_MAX, TRYTE_MIN)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('tryteWeightedSum', () => {
  it('TRYTE_MAX with uniform weight = 6', () => {
    expect(tryteWeightedSum(TRYTE_MAX)).toBe(6);
  });
  it('TRYTE_MIN with uniform weight = -6', () => {
    expect(tryteWeightedSum(TRYTE_MIN)).toBe(-6);
  });
  it('custom weights', () => {
    const t: typeof TRYTE_MAX = [1, 0, -1, 1, 0, -1];
    const w: typeof TRYTE_MAX = [2, 1, 1, 2, 1, 1];
    expect(tryteWeightedSum(t, w)).toBe(2); // 2 + 0 + (-1) + 2 + 0 + (-1) = 2
  });
});

describe('tryteDotProduct', () => {
  it('TRYTE_MAX · TRYTE_MAX = 6', () => {
    expect(tryteDotProduct(TRYTE_MAX, TRYTE_MAX)).toBe(6);
  });
  it('TRYTE_MAX · TRYTE_MIN = -6', () => {
    expect(tryteDotProduct(TRYTE_MAX, TRYTE_MIN)).toBe(-6);
  });
});

describe('tryteCertainty', () => {
  it('TRYTE_MAX = 6 certain', () => { expect(tryteCertainty(TRYTE_MAX)).toBe(6); });
  it('TRYTE_ZERO = 0 certain', () => { expect(tryteCertainty(TRYTE_ZERO)).toBe(0); });
  it('[1,0,-1,1,0,-1] = 4 certain', () => {
    expect(tryteCertainty([1, 0, -1, 1, 0, -1])).toBe(4);
  });
});

describe('tryteDominantDirection', () => {
  it('TRYTE_MAX → +1', () => { expect(tryteDominantDirection(TRYTE_MAX)).toBe(1); });
  it('TRYTE_MIN → -1', () => { expect(tryteDominantDirection(TRYTE_MIN)).toBe(-1); });
  it('[1,1,1,-1,-1,-1] → 0', () => {
    expect(tryteDominantDirection([1, 1, 1, -1, -1, -1])).toBe(0);
  });
});

describe('tryteMerge — 取更确定的值', () => {
  it('merge [1,0,0,0,0,0] + [0,0,1,0,0,0] = [1,0,1,0,0,0]', () => {
    const a: typeof TRYTE_MAX = [1, 0, 0, 0, 0, 0];
    const b: typeof TRYTE_MAX = [0, 0, 1, 0, 0, 0];
    expect(tryteMerge(a, b)).toEqual([1, 0, 1, 0, 0, 0]);
  });
  it('当两者相同时取第一个（非 0 优先）', () => {
    const a: typeof TRYTE_MAX = [1, 0, -1, 0, 0, 0];
    const b: typeof TRYTE_MAX = [-1, 1, 0, 0, 0, 0];
    expect(tryteMerge(a, b)).toEqual([1, 1, -1, 0, 0, 0]);
  });
});
