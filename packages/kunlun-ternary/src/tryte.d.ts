import type { Trit } from './trit.js';
/**
 * Tryte — 6个Trit组成的复合三进制值
 *
 * 可表示 3^6 = 729 种状态。
 * 用于更精细的信度/状态编码。
 *
 * 索引语义 (0-5):
 *   [0] = 正确性 (correctness)
 *   [1] = 完整性 (completeness)
 *   [2] = 一致性 (consistency)
 *   [3] = 时效性 (timeliness)
 *   [4] = 可靠性 (reliability)
 *   [5] = 可用性 (usability)
 */
export type Tryte = [Trit, Trit, Trit, Trit, Trit, Trit];
/** 全 +1 的 Tryte（完全确认） */
export declare const TRYTE_MAX: Tryte;
/** 全 0 的 Tryte（完全未知） */
export declare const TRYTE_ZERO: Tryte;
/** 全 -1 的 Tryte（完全否定） */
export declare const TRYTE_MIN: Tryte;
/**
 * 将 Tryte 转换为 0~728 的整数值（便于排序/比较）
 */
export declare function tryteToValue(t: Tryte): number;
/**
 * 将 0~728 的整数值恢复为 Tryte
 */
export declare function valueToTryte(v: number): Tryte;
/**
 * 验证是否为合法 Tryte
 */
export declare function isValidTryte(v: unknown): v is Tryte;
/**
 * Tryte 向量加法（逐元素 Trit 加）
 */
export declare function tryteAdd(a: Tryte, b: Tryte): number[];
/**
 * Tryte 信度加权和（weighted sum）
 */
export declare function tryteWeightedSum(t: Tryte, weights?: Tryte): number;
/**
 * 两个 Tryte 的点积
 */
export declare function tryteDotProduct(a: Tryte, b: Tryte): number;
/**
 * Tryte 中确定位（非0）的个数
 */
export declare function tryteCertainty(t: Tryte): number;
/**
 * Tryte 的优势方向
 * @returns +1=总体肯定, 0=中性/不确定, -1=总体否定
 */
export declare function tryteDominantDirection(t: Tryte): Trit;
/**
 * 合并两个 Tryte（取更确定的值）
 * 如果某维度两个值不同，优先取非0的值
 */
export declare function tryteMerge(a: Tryte, b: Tryte): Tryte;
/**
 * Tryte 维度名称
 */
export declare const TRYTE_DIMENSIONS: readonly ["正确性", "完整性", "一致性", "时效性", "可靠性", "可用性"];
export type TryteDimension = (typeof TRYTE_DIMENSIONS)[number];
//# sourceMappingURL=tryte.d.ts.map