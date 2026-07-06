import { T_TRUE, T_UNKNOWN, T_FALSE, tritFromBoolean, tritToBoolean, isCertain } from './trit.js';
import { K3 } from './k3.js';
/**
 * TernaryLogic — 三进制逻辑复合工具类
 *
 * 组合 Trit 常量、K3 运算、Tryte 操作，提供统一的
 * 三进制编程接口。上层所有 Trit/Tryte 判定最终落
 * 到这里。
 */
export class TernaryLogic {
    // ─── 常量 ──────────────────────────────────────
    static TRUE = T_TRUE;
    static UNKNOWN = T_UNKNOWN;
    static FALSE = T_FALSE;
    // ─── K3 运算 (转发) ────────────────────────────
    static not = K3.not;
    static and = K3.and;
    static or = K3.or;
    static nand = K3.nand;
    static nor = K3.nor;
    static xor = K3.xor;
    static imply = K3.imply;
    static equiv = K3.equiv;
    static majority = K3.majority;
    static consensus = K3.consensus;
    // ─── 类型转换 ──────────────────────────────────
    static fromBoolean = tritFromBoolean;
    static toBoolean = tritToBoolean;
    static isCertain = isCertain;
    // ─── Trit 数组运算 ─────────────────────────────
    /** Trit 数组求和 */
    static sum(trits) {
        return trits.reduce((s, t) => s + t, 0);
    }
    /** Trit 数组乘积（用于点积） */
    static dotProduct(a, b) {
        let sum = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            sum += (a[i] * b[i]);
        }
        return sum;
    }
    /** Trit 数组 AND 归约 */
    static reduceAnd(trits) {
        if (trits.length === 0)
            return T_TRUE; // 空集 AND = TRUE（幺元）
        return trits.reduce(K3.and);
    }
    /** Trit 数组 OR 归约 */
    static reduceOr(trits) {
        if (trits.length === 0)
            return T_FALSE; // 空集 OR = FALSE（幺元）
        return trits.reduce(K3.or);
    }
    // ─── Tryte 操作 ────────────────────────────────
    /** Tryte → 0~728 数值 */
    static tryteToValue(t) {
        let value = 0;
        for (let i = 0; i < 6; i++) {
            value = value * 3 + (t[i] + 1);
        }
        return value;
    }
    /** 0~728 → Tryte */
    static valueToTryte(v) {
        const digits = [];
        let remaining = v;
        for (let i = 0; i < 6; i++) {
            digits.unshift((remaining % 3) - 1);
            remaining = Math.floor(remaining / 3);
        }
        return digits;
    }
    /** Tryte 加权和 */
    static tryteWeightedSum(t, weights) {
        const w = weights || [1, 1, 1, 1, 1, 1];
        let sum = 0;
        for (let i = 0; i < 6; i++) {
            sum += (t[i] * w[i]);
        }
        return sum;
    }
}
//# sourceMappingURL=ternary-logic.js.map