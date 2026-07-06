import { T_TRUE, T_UNKNOWN, T_FALSE, isValidTrit } from './trit.js';
/** 全 +1 的 Tryte（完全确认） */
export const TRYTE_MAX = [1, 1, 1, 1, 1, 1];
/** 全 0 的 Tryte（完全未知） */
export const TRYTE_ZERO = [0, 0, 0, 0, 0, 0];
/** 全 -1 的 Tryte（完全否定） */
export const TRYTE_MIN = [-1, -1, -1, -1, -1, -1];
/**
 * 将 Tryte 转换为 0~728 的整数值（便于排序/比较）
 */
export function tryteToValue(t) {
    let value = 0;
    for (let i = 0; i < 6; i++) {
        const shifted = (t[i] + 1); // -1→0, 0→1, 1→2
        value = value * 3 + shifted;
    }
    return value;
}
/**
 * 将 0~728 的整数值恢复为 Tryte
 */
export function valueToTryte(v) {
    const digits = [];
    let remaining = v;
    for (let i = 0; i < 6; i++) {
        digits.unshift((remaining % 3) - 1); // 0→-1, 1→0, 2→1
        remaining = Math.floor(remaining / 3);
    }
    return digits;
}
/**
 * 验证是否为合法 Tryte
 */
export function isValidTryte(v) {
    if (!Array.isArray(v) || v.length !== 6)
        return false;
    return v.every(isValidTrit);
}
/**
 * Tryte 向量加法（逐元素 Trit 加）
 */
export function tryteAdd(a, b) {
    return a.map((t, i) => t + (b[i]));
}
/**
 * Tryte 信度加权和（weighted sum）
 */
export function tryteWeightedSum(t, weights) {
    const w = weights || [1, 1, 1, 1, 1, 1];
    let sum = 0;
    for (let i = 0; i < 6; i++) {
        sum += (t[i] * w[i]);
    }
    return sum;
}
/**
 * 两个 Tryte 的点积
 */
export function tryteDotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < 6; i++) {
        sum += (a[i] * b[i]);
    }
    return sum;
}
/**
 * Tryte 中确定位（非0）的个数
 */
export function tryteCertainty(t) {
    let count = 0;
    for (let i = 0; i < 6; i++) {
        if (t[i] !== 0)
            count++;
    }
    return count;
}
/**
 * Tryte 的优势方向
 * @returns +1=总体肯定, 0=中性/不确定, -1=总体否定
 */
export function tryteDominantDirection(t) {
    let sum = 0;
    for (let i = 0; i < 6; i++) {
        sum += t[i];
    }
    if (sum > 0)
        return T_TRUE;
    if (sum < 0)
        return T_FALSE;
    return T_UNKNOWN;
}
/**
 * 合并两个 Tryte（取更确定的值）
 * 如果某维度两个值不同，优先取非0的值
 */
export function tryteMerge(a, b) {
    return a.map((va, i) => {
        const vb = b[i];
        if (va !== 0)
            return va;
        return vb;
    });
}
/**
 * Tryte 维度名称
 */
export const TRYTE_DIMENSIONS = [
    '正确性',
    '完整性',
    '一致性',
    '时效性',
    '可靠性',
    '可用性',
];
//# sourceMappingURL=tryte.js.map