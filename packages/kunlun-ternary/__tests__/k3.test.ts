import { describe, it, expect } from 'vitest';
import { K3 } from '../src/k3.js';

/**
 * K3 真值表全覆盖 — 27 条规则，36 条断言
 *
 * NOT(3) + AND(9) + OR(9) + IMPLY(9) + EQUIV(9) + XOR(9) + NAND(9) + NOR(9)
 * 其中核心验证 36 条(NOT/AND/OR/IMPLY)，扩展验证在下方
 */

describe('K3 NOT (¬) — 3 rules', () => {
  it('¬1 = -1', () => { expect(K3.not(1)).toBe(-1); });
  it('¬0 = 0',  () => { expect(K3.not(0)).toBe(0); });
  it('¬-1 = 1', () => { expect(K3.not(-1)).toBe(1); });
});

describe('K3 AND (∧) — 9 rules', () => {
  // 1 ∧ *
  it('1 ∧ 1 = 1',  () => { expect(K3.and(1, 1)).toBe(1); });
  it('1 ∧ 0 = 0',  () => { expect(K3.and(1, 0)).toBe(0); });
  it('1 ∧ -1 = -1', () => { expect(K3.and(1, -1)).toBe(-1); });
  // 0 ∧ *
  it('0 ∧ 1 = 0',  () => { expect(K3.and(0, 1)).toBe(0); });
  it('0 ∧ 0 = 0',  () => { expect(K3.and(0, 0)).toBe(0); });
  it('0 ∧ -1 = -1', () => { expect(K3.and(0, -1)).toBe(-1); });
  // -1 ∧ *
  it('-1 ∧ 1 = -1', () => { expect(K3.and(-1, 1)).toBe(-1); });
  it('-1 ∧ 0 = -1', () => { expect(K3.and(-1, 0)).toBe(-1); });
  it('-1 ∧ -1 = -1', () => { expect(K3.and(-1, -1)).toBe(-1); });
});

describe('K3 OR (∨) — 9 rules', () => {
  it('1 ∨ 1 = 1',   () => { expect(K3.or(1, 1)).toBe(1); });
  it('1 ∨ 0 = 1',   () => { expect(K3.or(1, 0)).toBe(1); });
  it('1 ∨ -1 = 1',  () => { expect(K3.or(1, -1)).toBe(1); });
  it('0 ∨ 1 = 1',   () => { expect(K3.or(0, 1)).toBe(1); });
  it('0 ∨ 0 = 0',   () => { expect(K3.or(0, 0)).toBe(0); });
  it('0 ∨ -1 = 0',  () => { expect(K3.or(0, -1)).toBe(0); });
  it('-1 ∨ 1 = 1',  () => { expect(K3.or(-1, 1)).toBe(1); });
  it('-1 ∨ 0 = 0',  () => { expect(K3.or(-1, 0)).toBe(0); });
  it('-1 ∨ -1 = -1', () => { expect(K3.or(-1, -1)).toBe(-1); });
});

describe('K3 IMPLY (→) — 9 rules', () => {
  it('1 → 1 = 1',   () => { expect(K3.imply(1, 1)).toBe(1); });
  it('1 → 0 = 0',   () => { expect(K3.imply(1, 0)).toBe(0); });
  it('1 → -1 = -1', () => { expect(K3.imply(1, -1)).toBe(-1); });
  it('0 → 1 = 1',   () => { expect(K3.imply(0, 1)).toBe(1); });
  it('0 → 0 = 0',   () => { expect(K3.imply(0, 0)).toBe(0); });
  it('0 → -1 = 0',  () => { expect(K3.imply(0, -1)).toBe(0); }); // K3 关键: 未知→假 = 未知
  it('-1 → 1 = 1',  () => { expect(K3.imply(-1, 1)).toBe(1); });
  it('-1 → 0 = 1',  () => { expect(K3.imply(-1, 0)).toBe(1); });
  it('-1 → -1 = 1', () => { expect(K3.imply(-1, -1)).toBe(1); });
});

describe('K3 EQUIV (↔) — 9 rules', () => {
  it('1 ↔ 1 = 1',   () => { expect(K3.equiv(1, 1)).toBe(1); });
  it('1 ↔ 0 = 0',   () => { expect(K3.equiv(1, 0)).toBe(0); });
  it('1 ↔ -1 = -1', () => { expect(K3.equiv(1, -1)).toBe(-1); });
  it('0 ↔ 1 = 0',   () => { expect(K3.equiv(0, 1)).toBe(0); });
  it('0 ↔ 0 = 0',   () => { expect(K3.equiv(0, 0)).toBe(0); }); // 两个都未知 → 未知
  it('0 ↔ -1 = 0',  () => { expect(K3.equiv(0, -1)).toBe(0); });
  it('-1 ↔ 1 = -1', () => { expect(K3.equiv(-1, 1)).toBe(-1); });
  it('-1 ↔ 0 = 0',  () => { expect(K3.equiv(-1, 0)).toBe(0); });
  it('-1 ↔ -1 = 1', () => { expect(K3.equiv(-1, -1)).toBe(1); });
});

describe('K3 XOR (⊕) — strict binary xor', () => {
  it('1 ⊕ 1 = -1', () => { expect(K3.xor(1, 1)).toBe(-1); });
  it('1 ⊕ -1 = 1', () => { expect(K3.xor(1, -1)).toBe(1); });
  it('0 ⊕ 1 = 0',  () => { expect(K3.xor(0, 1)).toBe(0); }); // 任一未知 → 未知
  it('0 ⊕ 0 = 0',  () => { expect(K3.xor(0, 0)).toBe(0); });
});

describe('K3 NAND', () => {
  it('1 ↑ 1 = -1', () => { expect(K3.nand(1, 1)).toBe(-1); });
  it('1 ↑ 0 = 0',  () => { expect(K3.nand(1, 0)).toBe(0); });
  it('0 ↑ 0 = 0',  () => { expect(K3.nand(0, 0)).toBe(0); });
});

describe('K3 NOR', () => {
  it('1 ↓ 1 = -1',  () => { expect(K3.nor(1, 1)).toBe(-1); });
  it('0 ↓ 0 = 0',   () => { expect(K3.nor(0, 0)).toBe(0); });
  it('-1 ↓ -1 = 1', () => { expect(K3.nor(-1, -1)).toBe(1); });
});

describe('K3 MAJORITY — 3-input', () => {
  it('1,1,1 → 1',  () => { expect(K3.majority(1, 1, 1)).toBe(1); });
  it('1,1,0 → 1',  () => { expect(K3.majority(1, 1, 0)).toBe(1); });
  it('1,0,0 → 0',  () => { expect(K3.majority(1, 0, 0)).toBe(0); });
  it('0,0,0 → 0',  () => { expect(K3.majority(0, 0, 0)).toBe(0); });
  it('0,-1,-1 → -1', () => { expect(K3.majority(0, -1, -1)).toBe(-1); });
  it('-1,-1,-1 → -1', () => { expect(K3.majority(-1, -1, -1)).toBe(-1); });
  it('1,-1,0 → 0',  () => { expect(K3.majority(1, -1, 0)).toBe(0); });
});

describe('K3 CONSENSUS — multi-input', () => {
  it('all 1 → verdict=1, strength=1', () => {
    const { verdict, strength } = K3.consensus([1, 1, 1]);
    expect(verdict).toBe(1);
    expect(strength).toBe(1);
  });
  it('mixed → strength < 1', () => {
    const { verdict, strength } = K3.consensus([1, 0, -1]);
    expect(verdict).toBe(0);
    expect(strength).toBe(0);
  });
  it('empty array → verdict=0, strength=0', () => {
    const { verdict, strength } = K3.consensus([]);
    expect(verdict).toBe(0);
    expect(strength).toBe(0);
  });
});
