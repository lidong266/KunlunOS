import type { Trit } from './trit.js';
import type { Tryte } from './tryte.js';
/**
 * TernaryLogic — 三进制逻辑复合工具类
 *
 * 组合 Trit 常量、K3 运算、Tryte 操作，提供统一的
 * 三进制编程接口。上层所有 Trit/Tryte 判定最终落
 * 到这里。
 */
export declare class TernaryLogic {
    static readonly TRUE: Trit;
    static readonly UNKNOWN: Trit;
    static readonly FALSE: Trit;
    static not: (a: Trit) => Trit;
    static and: (a: Trit, b: Trit) => Trit;
    static or: (a: Trit, b: Trit) => Trit;
    static nand: (a: Trit, b: Trit) => Trit;
    static nor: (a: Trit, b: Trit) => Trit;
    static xor: (a: Trit, b: Trit) => Trit;
    static imply: (a: Trit, b: Trit) => Trit;
    static equiv: (a: Trit, b: Trit) => Trit;
    static majority: (a: Trit, b: Trit, c: Trit) => Trit;
    static consensus: (values: Trit[]) => {
        verdict: Trit;
        strength: number;
    };
    static fromBoolean: (b: boolean) => Trit;
    static toBoolean: (t: Trit, unknownAsFalse?: boolean) => boolean;
    static isCertain: (t: Trit) => boolean;
    /** Trit 数组求和 */
    static sum(trits: Trit[]): number;
    /** Trit 数组乘积（用于点积） */
    static dotProduct(a: Trit[], b: Trit[]): number;
    /** Trit 数组 AND 归约 */
    static reduceAnd(trits: Trit[]): Trit;
    /** Trit 数组 OR 归约 */
    static reduceOr(trits: Trit[]): Trit;
    /** Tryte → 0~728 数值 */
    static tryteToValue(t: Tryte): number;
    /** 0~728 → Tryte */
    static valueToTryte(v: number): Tryte;
    /** Tryte 加权和 */
    static tryteWeightedSum(t: Tryte, weights?: Tryte): number;
}
//# sourceMappingURL=ternary-logic.d.ts.map