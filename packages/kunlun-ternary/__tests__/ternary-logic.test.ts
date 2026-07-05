import { describe, it, expect } from 'vitest';
import { TernaryLogic as TL } from '../src/ternary-logic.js';

describe('TernaryLogic — 复合工具类', () => {
  it('常量正确导出', () => {
    expect(TL.TRUE).toBe(1);
    expect(TL.UNKNOWN).toBe(0);
    expect(TL.FALSE).toBe(-1);
  });

  it('K3 运算转发正确', () => {
    expect(TL.not(1)).toBe(-1);
    expect(TL.and(1, 0)).toBe(0);
    expect(TL.or(-1, 0)).toBe(0);
    expect(TL.imply(0, -1)).toBe(0); // K3 关键规则
    expect(TL.majority(1, 0, -1)).toBe(0);
  });

  it('sum: [1,1,-1] = 1', () => {
    expect(TL.sum([1, 1, -1])).toBe(1);
  });

  it('dotProduct: [1,0,-1] · [1,1,1] = 0', () => {
    expect(TL.dotProduct([1, 0, -1], [1, 1, 1])).toBe(0);
  });

  it('reduceAnd: [1,1,0] → 0', () => {
    expect(TL.reduceAnd([1, 1, 0])).toBe(0);
  });

  it('reduceAnd: [] → 1 (幺元)', () => {
    expect(TL.reduceAnd([])).toBe(1);
  });

  it('reduceOr: [0,0,-1] → 0', () => {
    expect(TL.reduceOr([0, 0, -1])).toBe(0);
  });

  it('reduceOr: [] → -1 (幺元)', () => {
    expect(TL.reduceOr([])).toBe(-1);
  });

  it('tryteToValue / valueToTryte round-trip', () => {
    const t: [1, 0, -1, 1, 0, -1] = [1, 0, -1, 1, 0, -1];
    expect(TL.valueToTryte(TL.tryteToValue(t))).toEqual(t);
  });

  it('tryteWeightedSum 默认权重', () => {
    expect(TL.tryteWeightedSum([1, 0, -1, 1, 0, -1])).toBe(0);
  });
});
