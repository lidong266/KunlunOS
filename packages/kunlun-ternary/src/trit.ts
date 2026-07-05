/**
 * Trit — 三进制最基本单位
 *
 * +1 = 真/确认/强化/肯定
 *  0 = 未知/待验证/观察/中立
 * -1 = 假/否定/消退/反对
 */
export type Trit = 1 | 0 | -1;

/** 三进制命名常量 */
export const T_TRUE = 1 as Trit;
export const T_UNKNOWN = 0 as Trit;
export const T_FALSE = -1 as Trit;

/** Trit 谓词 */
export const isTrue = (t: Trit): boolean => t === 1;
export const isUnknown = (t: Trit): boolean => t === 0;
export const isFalse = (t: Trit): boolean => t === -1;
export const isCertain = (t: Trit): boolean => t !== 0;

/** 布尔 ↔ Trit 转换 */
export const tritFromBoolean = (b: boolean): Trit => (b ? 1 : -1);
export const tritToBoolean = (t: Trit, unknownAsFalse = true): boolean => {
  if (t === 1) return true;
  if (t === -1) return false;
  return !unknownAsFalse; // 0 → true if unknownAsFalse is false
};

/** Trit 比较 */
export const tritEq = (a: Trit, b: Trit): boolean => a === b;

/** Trit 运算符重载风格 */
export const TritMath = {
  /** 两个 Trit 相加（用于多数表决等） */
  add(a: Trit, b: Trit): number {
    return a + b;
  },
  /** 取反 */
  negate(t: Trit): Trit {
    if (t === 1) return -1;
    if (t === -1) return 1;
    return 0;
  },
  /** 符号函数: +1 → 1, 0 → 0, -1 → -1 */
  sign(t: Trit): number {
    return t;
  },
  /** 绝对值 */
  abs(t: Trit): number {
    return Math.abs(t);
  },
};

/**
 * 校验值是否为合法 Trit
 */
export function isValidTrit(value: number): value is Trit {
  return value === 1 || value === 0 || value === -1;
}

/**
 * 安全转换：任意 number → Trit（最接近值）
 */
export function clampToTrit(value: number): Trit {
  if (value >= 0.5) return 1;
  if (value <= -0.5) return -1;
  return 0;
}
