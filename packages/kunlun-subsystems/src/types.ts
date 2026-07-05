/**
 * 子系统共享类型
 * 定义跨子系统使用的通用类型
 */

import type { Trit, Tryte } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════
// ContradictionPair — 矛盾对
// ═══════════════════════════════════════════════════════════

export interface ContradictionPair {
  /** 正题 */
  thesis: string;
  /** 反题 */
  antithesis: string;
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/** 从 Trit 数组创建 Tryte */
export function tryteFromTrits(trits: [Trit, Trit, Trit, Trit, Trit, Trit]): Tryte {
  return [...trits] as Tryte;
}

/** 将 Tryte 转换为 Trit 数组 */
export function tryteToTrits(t: Tryte): Trit[] {
  return [...t];
}

/** 获取 Tryte 中特定维度的 Trit */
export function tryteGetDimension(t: Tryte, dim: number): Trit {
  return t[dim] as Trit;
}
