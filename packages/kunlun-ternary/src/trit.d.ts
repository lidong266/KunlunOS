/**
 * Trit — 三进制最基本单位
 *
 * +1 = 真/确认/强化/肯定
 *  0 = 未知/待验证/观察/中立
 * -1 = 假/否定/消退/反对
 */
export type Trit = 1 | 0 | -1;
/** 三进制命名常量 */
export declare const T_TRUE: Trit;
export declare const T_UNKNOWN: Trit;
export declare const T_FALSE: Trit;
/** Trit 谓词 */
export declare const isTrue: (t: Trit) => boolean;
export declare const isUnknown: (t: Trit) => boolean;
export declare const isFalse: (t: Trit) => boolean;
export declare const isCertain: (t: Trit) => boolean;
/** 布尔 ↔ Trit 转换 */
export declare const tritFromBoolean: (b: boolean) => Trit;
export declare const tritToBoolean: (t: Trit, unknownAsFalse?: boolean) => boolean;
/** Trit 比较 */
export declare const tritEq: (a: Trit, b: Trit) => boolean;
/** Trit 运算符重载风格 */
export declare const TritMath: {
    /** 两个 Trit 相加（用于多数表决等） */
    add(a: Trit, b: Trit): number;
    /** 取反 */
    negate(t: Trit): Trit;
    /** 符号函数: +1 → 1, 0 → 0, -1 → -1 */
    sign(t: Trit): number;
    /** 绝对值 */
    abs(t: Trit): number;
};
/**
 * 校验值是否为合法 Trit
 */
export declare function isValidTrit(value: number): value is Trit;
/**
 * 安全转换：任意 number → Trit（最接近值）
 */
export declare function clampToTrit(value: number): Trit;
//# sourceMappingURL=trit.d.ts.map