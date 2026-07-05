/**
 * 集成测试自定义断言
 * Trit/Tryte 类型安全和语义验证
 */

import { expect } from 'vitest';
import type { Trit, Tryte } from '@kunlun/ternary';
import { T_TRUE, T_FALSE, T_UNKNOWN, valueToTryte, tryteToValue } from '@kunlun/ternary';

// ─── Trit 断言 ───

/** 断言值为 T_TRUE (+1) */
export function assertTritTrue(value: Trit, msg?: string): void {
  expect(value, msg ?? 'expected T_TRUE (+1)').toBe(T_TRUE);
}

/** 断言值为 T_FALSE (-1) */
export function assertTritFalse(value: Trit, msg?: string): void {
  expect(value, msg ?? 'expected T_FALSE (-1)').toBe(T_FALSE);
}

/** 断言值为 T_UNKNOWN (0) */
export function assertTritUnknown(value: Trit, msg?: string): void {
  expect(value, msg ?? 'expected T_UNKNOWN (0)').toBe(T_UNKNOWN);
}

/** 断言 Trit 为有效值 (+1, 0, -1 之一) */
export function assertTritValid(value: Trit): void {
  expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(value);
}

/** 断言两 Trit 相等 */
export function assertTritEqual(actual: Trit, expected: Trit, msg?: string): void {
  expect(actual, msg ?? `expected Trit ${expected} but got ${actual}`).toBe(expected);
}

// ─── Tryte 断言 ───

/** 断言 Tryte 编解码无损 */
export function assertTryteRoundtrip(value: number, tolerance: number = 1): void {
  const tryte = valueToTryte(value);
  const decoded = tryteToValue(tryte);
  expect(Math.abs(decoded - value), `Tryte roundtrip error: ${value} → ${decoded}`).toBeLessThan(tolerance);
}

/** 断言 Tryte 所有维度为指定 Trit */
export function assertTryteAllDimensions(tryte: Tryte, expected: Trit): void {
  for (let i = 0; i < 6; i++) {
    expect(tryte[i], `dimension ${i} expected ${expected}`).toBe(expected);
  }
}

/** 断言 Tryte 长度正确 */
export function assertTryteValid(tryte: Tryte): void {
  expect(tryte).toHaveLength(6);
  for (const trit of tryte) {
    assertTritValid(trit);
  }
}

// ─── 时序断言 ───

/** 断言数值在容差范围内 */
export function assertApproximately(actual: number, expected: number, tolerance: number = 0.1, msg?: string): void {
  expect(Math.abs(actual - expected), msg ?? `expected ~${expected} but got ${actual}`).toBeLessThanOrEqual(tolerance);
}

/** 断言时间戳合理（在最近 60 秒内） */
export function assertRecentTimestamp(ts: number, windowMs: number = 60000): void {
  const now = Date.now();
  expect(now - ts, 'timestamp too old').toBeLessThanOrEqual(windowMs);
}

// ─── 数组 / 集合断言 ───

/** 断言数组非空且所有元素满足条件 */
export function assertAll<T>(arr: T[], predicate: (item: T) => boolean, msg?: string): void {
  expect(arr.length, msg ? `${msg}: empty array` : 'array should not be empty').toBeGreaterThan(0);
  for (let i = 0; i < arr.length; i++) {
    expect(predicate(arr[i]), msg ? `${msg} at index ${i}` : `predicate failed at index ${i}`).toBe(true);
  }
}

/** 断言数组至少有一个元素满足条件 */
export function assertAny<T>(arr: T[], predicate: (item: T) => boolean, msg?: string): void {
  const found = arr.some(predicate);
  expect(found, msg ?? 'no element matches predicate').toBe(true);
}
