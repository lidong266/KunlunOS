import type { Trit } from './trit.js';
/**
 * K3 三值逻辑（Kleene K3）
 *
 * K3 是 Kleene 强三值逻辑。核心规则：
 *   - 未知(0)具有"传播性"：任何涉及未知的运算，如果结果不
 *     取决于未知值，则返回确定值；否则返回未知。
 *   - 与经典二值逻辑兼容：当所有输入为 +1/-1 时，结果与布尔
 *     逻辑一致。
 *
 * 真值表（Kleene 定义）:
 *   NOT:   ¬+1=-1,  ¬0=0,      ¬-1=+1
 *   AND:   ∧ 最小原则（含0即0,除非有-1）
 *   OR:    ∨ 最大原则（含+1即+1,除非全-1）
 *   IMPLY: A→B = ¬A ∨ B
 *   EQUIV:  A↔B = (A→B) ∧ (B→A)
 */
declare const K3: {
    /** 三元非：¬A */
    not(a: Trit): Trit;
    /** 三元与：A ∧ B */
    and(a: Trit, b: Trit): Trit;
    /** 三元或：A ∨ B */
    or(a: Trit, b: Trit): Trit;
    /** 三元与非：¬(A ∧ B) */
    nand(a: Trit, b: Trit): Trit;
    /** 三元或非：¬(A ∨ B) */
    nor(a: Trit, b: Trit): Trit;
    /** 三元异或：严格意义上的二元异或（两边都确定时才确定） */
    xor(a: Trit, b: Trit): Trit;
    /**
     * 三元蕴含：A → B ≡ ¬A ∨ B
     *
     * 真值表:
     *   1 → 1  = 1   真蕴含真 = 真
     *   1 → 0  = 0   真蕴含未知 = 未知
     *   1 → -1 = -1  真蕴含假 = 假
     *   0 → 1  = 1   未知蕴含真 = 真
     *   0 → 0  = 0   未知蕴含未知 = 未知
     *   0 → -1 = 0   未知蕴含假 = 未知（K3 关键特征）
     *  -1 → 1  = 1   假蕴含真 = 真
     *  -1 → 0  = 1   假蕴含未知 = 真
     *  -1 → -1 = 1   假蕴含假 = 真
     */
    imply(a: Trit, b: Trit): Trit;
    /** 三元等价：A ↔ B */
    equiv(a: Trit, b: Trit): Trit;
    /** 三输入多数表决 */
    majority(a: Trit, b: Trit, c: Trit): Trit;
    /**
     * 多输入共识判定
     * @returns verdict=抉择方向, strength=共识强度(0~1)
     */
    consensus(values: Trit[]): {
        verdict: Trit;
        strength: number;
    };
};
export default K3;
export { K3 };
//# sourceMappingURL=k3.d.ts.map