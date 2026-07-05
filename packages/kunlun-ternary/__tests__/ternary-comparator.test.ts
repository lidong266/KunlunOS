import { describe, it, expect } from 'vitest';
import { TernaryComparator } from '../src/ternary-comparator.js';

describe('TernaryComparator.equal', () => {
  it('精确相等: 1,1 → +1', () => {
    expect(TernaryComparator.equal(1, 1)).toBe(1);
  });
  it('精确不相等: 1,2 → -1', () => {
    expect(TernaryComparator.equal(1, 2)).toBe(-1);
  });
  it('容差内极小差异 → +1', () => {
    expect(TernaryComparator.equal(100, 101, 10)).toBe(1);
  });
  it('容差边界 → 0', () => {
    expect(TernaryComparator.equal(100, 108, 10)).toBe(0);
  });
  it('超出容差 → -1', () => {
    expect(TernaryComparator.equal(100, 120, 10)).toBe(-1);
  });
  it('字符串相等 → +1', () => {
    expect(TernaryComparator.equal('hello', 'hello')).toBe(1);
  });
  it('字符串不相等 → -1', () => {
    expect(TernaryComparator.equal('hello', 'world')).toBe(-1);
  });
});

describe('TernaryComparator.semanticMatch', () => {
  it('0.9 → +1 (高于阈值)', () => {
    expect(TernaryComparator.semanticMatch(0.9)).toBe(1);
  });
  it('0.85 → +1 (等于高阈值)', () => {
    expect(TernaryComparator.semanticMatch(0.85)).toBe(1);
  });
  it('0.7 → 0 (在阈值之间)', () => {
    expect(TernaryComparator.semanticMatch(0.7)).toBe(0);
  });
  it('0.5 → -1 (等于低阈值)', () => {
    expect(TernaryComparator.semanticMatch(0.5)).toBe(-1);
  });
  it('0.3 → -1 (低于阈值)', () => {
    expect(TernaryComparator.semanticMatch(0.3)).toBe(-1);
  });
});

describe('TernaryComparator.threshold', () => {
  it('1.3 vs 1.0 → +1', () => {
    expect(TernaryComparator.threshold(1.3, 1.0)).toBe(1);
  });
  it('0.95 vs 1.0 → 0', () => {
    expect(TernaryComparator.threshold(0.95, 1.0)).toBe(0);
  });
  it('0.8 vs 1.0 → -1', () => {
    expect(TernaryComparator.threshold(0.8, 1.0)).toBe(-1);
  });
  it('target=0 时使用绝对值边际', () => {
    expect(TernaryComparator.threshold(0.05, 0, 0.1)).toBe(0);
    expect(TernaryComparator.threshold(0.2, 0, 0.1)).toBe(1);
  });
});

describe('TernaryComparator.inRange', () => {
  it('5 in [0,10] → +1', () => {
    expect(TernaryComparator.inRange(5, 0, 10)).toBe(1);
  });
  it('0.1 in [0,10] margin=0.05 → 0 (边界附近)', () => {
    expect(TernaryComparator.inRange(0.1, 0, 10, 0.05)).toBe(0);
  });
  it('-1 in [0,10] → -1', () => {
    expect(TernaryComparator.inRange(-1, 0, 10)).toBe(-1);
  });
});
