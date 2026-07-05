import { describe, it, expect } from 'vitest';
import {
  T_TRUE,
  T_UNKNOWN,
  T_FALSE,
  isTrue,
  isUnknown,
  isFalse,
  isCertain,
  tritFromBoolean,
  tritToBoolean,
  isValidTrit,
  clampToTrit,
  TritMath,
} from '../src/trit.js';
import type { Trit } from '../src/trit.js';

describe('Trit constants', () => {
  it('T_TRUE = 1', () => { expect(T_TRUE).toBe(1); });
  it('T_UNKNOWN = 0', () => { expect(T_UNKNOWN).toBe(0); });
  it('T_FALSE = -1', () => { expect(T_FALSE).toBe(-1); });
});

describe('Trit predicates', () => {
  it('isTrue(1) === true', () => { expect(isTrue(1)).toBe(true); });
  it('isTrue(0) === false', () => { expect(isTrue(0)).toBe(false); });
  it('isUnknown(0) === true', () => { expect(isUnknown(0)).toBe(true); });
  it('isUnknown(1) === false', () => { expect(isUnknown(1)).toBe(false); });
  it('isFalse(-1) === true', () => { expect(isFalse(-1)).toBe(true); });
  it('isCertain(0) === false', () => { expect(isCertain(0)).toBe(false); });
  it('isCertain(1) === true', () => { expect(isCertain(1)).toBe(true); });
  it('isCertain(-1) === true', () => { expect(isCertain(-1)).toBe(true); });
});

describe('tritFromBoolean / tritToBoolean', () => {
  it('tritFromBoolean(true) = 1', () => { expect(tritFromBoolean(true)).toBe(1); });
  it('tritFromBoolean(false) = -1 (not 0!)', () => { expect(tritFromBoolean(false)).toBe(-1); });
  it('tritToBoolean(1) = true', () => { expect(tritToBoolean(1)).toBe(true); });
  it('tritToBoolean(-1) = false', () => { expect(tritToBoolean(-1)).toBe(false); });
  it('tritToBoolean(0) = false (default)', () => { expect(tritToBoolean(0)).toBe(false); });
  it('tritToBoolean(0, false) = true', () => { expect(tritToBoolean(0, false)).toBe(true); });
});

describe('isValidTrit', () => {
  it('valid: 1, 0, -1', () => {
    expect(isValidTrit(1)).toBe(true);
    expect(isValidTrit(0)).toBe(true);
    expect(isValidTrit(-1)).toBe(true);
  });
  it('invalid: 2, 0.5, NaN', () => {
    expect(isValidTrit(2)).toBe(false);
    expect(isValidTrit(0.5)).toBe(false);
    expect(isValidTrit(NaN)).toBe(false);
  });
});

describe('clampToTrit', () => {
  it('0.9 → 1', () => { expect(clampToTrit(0.9)).toBe(1); });
  it('0.5 → 1', () => { expect(clampToTrit(0.5)).toBe(1); });
  it('0.4 → 0', () => { expect(clampToTrit(0.4)).toBe(0); });
  it('-0.4 → 0', () => { expect(clampToTrit(-0.4)).toBe(0); });
  it('-0.5 → -1', () => { expect(clampToTrit(-0.5)).toBe(-1); });
  it('-0.9 → -1', () => { expect(clampToTrit(-0.9)).toBe(-1); });
});

describe('TritMath', () => {
  it('add(1, -1) = 0', () => { expect(TritMath.add(1, -1)).toBe(0); });
  it('negate(1) = -1', () => { expect(TritMath.negate(1)).toBe(-1); });
  it('negate(0) = 0', () => { expect(TritMath.negate(0)).toBe(0); });
  it('negate(-1) = 1', () => { expect(TritMath.negate(-1)).toBe(1); });
  it('abs(1) = 1', () => { expect(TritMath.abs(1)).toBe(1); });
  it('abs(-1) = 1', () => { expect(TritMath.abs(-1)).toBe(1); });
});
