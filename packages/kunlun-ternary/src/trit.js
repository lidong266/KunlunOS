/** 三进制命名常量 */
export const T_TRUE = 1;
export const T_UNKNOWN = 0;
export const T_FALSE = -1;
/** Trit 谓词 */
export const isTrue = (t) => t === 1;
export const isUnknown = (t) => t === 0;
export const isFalse = (t) => t === -1;
export const isCertain = (t) => t !== 0;
/** 布尔 ↔ Trit 转换 */
export const tritFromBoolean = (b) => (b ? 1 : -1);
export const tritToBoolean = (t, unknownAsFalse = true) => {
    if (t === 1)
        return true;
    if (t === -1)
        return false;
    return !unknownAsFalse; // 0 → true if unknownAsFalse is false
};
/** Trit 比较 */
export const tritEq = (a, b) => a === b;
/** Trit 运算符重载风格 */
export const TritMath = {
    /** 两个 Trit 相加（用于多数表决等） */
    add(a, b) {
        return a + b;
    },
    /** 取反 */
    negate(t) {
        if (t === 1)
            return -1;
        if (t === -1)
            return 1;
        return 0;
    },
    /** 符号函数: +1 → 1, 0 → 0, -1 → -1 */
    sign(t) {
        return t;
    },
    /** 绝对值 */
    abs(t) {
        return Math.abs(t);
    },
};
/**
 * 校验值是否为合法 Trit
 */
export function isValidTrit(value) {
    return value === 1 || value === 0 || value === -1;
}
/**
 * 安全转换：任意 number → Trit（最接近值）
 */
export function clampToTrit(value) {
    if (value >= 0.5)
        return 1;
    if (value <= -0.5)
        return -1;
    return 0;
}
//# sourceMappingURL=trit.js.map