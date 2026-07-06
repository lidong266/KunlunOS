import type { Trit } from './trit.js';
/**
 * TernaryComparator — 三进制比较器
 *
 * 所有比较操作返回 Trit，替代传统的 boolean 比较结果。
 *   +1 = 确认匹配/显著高于
 *    0 = 不确定/在阈值附近
 *   -1 = 不匹配/显著低于
 */
export declare class TernaryComparator {
    /**
     * 三元等值比较
     * @param a 值 A
     * @param b 值 B
     * @param tolerance 可选容差（仅对 number 有效）
     * @returns +1=相等, 0=不确定/部分匹配, -1=不相等
     */
    static equal<T>(a: T, b: T, tolerance?: number): Trit;
    /**
     * 三元语义匹配 — 用于文本/嵌入比较
     * @param similarity 相似度 0~1
     * @param highThreshold 高阈值(默认 0.85)，以上 = +1
     * @param lowThreshold 低阈值(默认 0.5)，以下 = -1
     */
    static semanticMatch(similarity: number, highThreshold?: number, lowThreshold?: number): Trit;
    /**
     * 三元阈值判断 — 替代 if (value > threshold)
     * @param value 当前值
     * @param target 目标值
     * @param margin 边际比例(默认 0.1 = 10%)
     * @returns +1=显著高于, 0=在阈值附近, -1=显著低于
     */
    static threshold(value: number, target: number, margin?: number): Trit;
    /**
     * 三元范围判断：值是否在 [min, max] 内
     * @returns +1=在范围内, 0=在边界附近, -1=明显在范围外
     */
    static inRange(value: number, min: number, max: number, margin?: number): Trit;
}
//# sourceMappingURL=ternary-comparator.d.ts.map