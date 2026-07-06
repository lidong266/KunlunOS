import { T_TRUE, T_FALSE, T_UNKNOWN } from './trit.js';
/**
 * TernaryComparator — 三进制比较器
 *
 * 所有比较操作返回 Trit，替代传统的 boolean 比较结果。
 *   +1 = 确认匹配/显著高于
 *    0 = 不确定/在阈值附近
 *   -1 = 不匹配/显著低于
 */
export class TernaryComparator {
    /**
     * 三元等值比较
     * @param a 值 A
     * @param b 值 B
     * @param tolerance 可选容差（仅对 number 有效）
     * @returns +1=相等, 0=不确定/部分匹配, -1=不相等
     */
    static equal(a, b, tolerance) {
        if (typeof a === 'number' && typeof b === 'number' && tolerance !== undefined) {
            const diff = Math.abs(a - b);
            if (diff <= tolerance * 0.1)
                return T_TRUE; // 极小差异 → 确认相等
            if (diff <= tolerance)
                return T_UNKNOWN; // 在容差内 → 不确定
            return T_FALSE; // 超出容差 → 不相等
        }
        // 非数值或无数值容差的精确比较
        return a === b ? T_TRUE : T_FALSE; // 精确比较有 0（因为完全确定）
    }
    /**
     * 三元语义匹配 — 用于文本/嵌入比较
     * @param similarity 相似度 0~1
     * @param highThreshold 高阈值(默认 0.85)，以上 = +1
     * @param lowThreshold 低阈值(默认 0.5)，以下 = -1
     */
    static semanticMatch(similarity, highThreshold = 0.85, lowThreshold = 0.5) {
        if (similarity >= highThreshold)
            return T_TRUE;
        if (similarity <= lowThreshold)
            return T_FALSE;
        return T_UNKNOWN;
    }
    /**
     * 三元阈值判断 — 替代 if (value > threshold)
     * @param value 当前值
     * @param target 目标值
     * @param margin 边际比例(默认 0.1 = 10%)
     * @returns +1=显著高于, 0=在阈值附近, -1=显著低于
     */
    static threshold(value, target, margin = 0.1) {
        if (target === 0) {
            // 目标为 0 时用绝对值边际
            const absMargin = margin;
            if (value > absMargin)
                return T_TRUE;
            if (value < -absMargin)
                return T_FALSE;
            return T_UNKNOWN;
        }
        const ratio = value / target;
        if (ratio > 1 + margin)
            return T_TRUE;
        if (ratio < 1 - margin)
            return T_FALSE;
        return T_UNKNOWN;
    }
    /**
     * 三元范围判断：值是否在 [min, max] 内
     * @returns +1=在范围内, 0=在边界附近, -1=明显在范围外
     */
    static inRange(value, min, max, margin = 0.05) {
        const range = max - min;
        const buffer = range * margin;
        if (value >= min + buffer && value <= max - buffer)
            return T_TRUE;
        if (value < min - buffer || value > max + buffer)
            return T_FALSE;
        return T_UNKNOWN;
    }
}
//# sourceMappingURL=ternary-comparator.js.map