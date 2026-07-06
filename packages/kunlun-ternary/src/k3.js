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
const K3 = {
    // ─── NOT ───────────────────────────────────────────
    /** 三元非：¬A */
    not(a) {
        if (a === 1)
            return -1;
        if (a === -1)
            return 1;
        return 0;
    },
    // ─── AND ───────────────────────────────────────────
    /** 三元与：A ∧ B */
    and(a, b) {
        if (a === -1 || b === -1)
            return -1; // 任一假 → 假
        if (a === 1 && b === 1)
            return 1; // 全真 → 真
        return 0; // 含未知 → 未知
    },
    // ─── OR ────────────────────────────────────────────
    /** 三元或：A ∨ B */
    or(a, b) {
        if (a === 1 || b === 1)
            return 1; // 任一真 → 真
        if (a === -1 && b === -1)
            return -1; // 全假 → 假
        return 0; // 含未知 → 未知
    },
    // ─── NAND ──────────────────────────────────────────
    /** 三元与非：¬(A ∧ B) */
    nand(a, b) {
        return K3.not(K3.and(a, b));
    },
    // ─── NOR ───────────────────────────────────────────
    /** 三元或非：¬(A ∨ B) */
    nor(a, b) {
        return K3.not(K3.or(a, b));
    },
    // ─── XOR ───────────────────────────────────────────
    /** 三元异或：严格意义上的二元异或（两边都确定时才确定） */
    xor(a, b) {
        if (a === 0 || b === 0)
            return 0; // 任一未知 → 未知
        return a !== b ? 1 : -1; // 不同→真，相同→假
    },
    // ─── IMPLICATION ────────────────────────────────────
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
    imply(a, b) {
        // a=1: 真前提
        if (a === 1) {
            if (b === 1)
                return 1; // 真 → 真 = 真
            if (b === 0)
                return 0; // 真 → 未知 = 未知（K3 传播）
            return -1; // 真 → 假 = 假
        }
        // a=0: 未知前提 — 结果不确定（K3 传播）
        if (a === 0) {
            if (b === 1)
                return 1; // 未知 → 真 = 真（无论前提如何，结论为真）
            return 0; // 未知 → 未知/假 = 未知（K3 不确定）
        }
        // a=-1: 假前提 → 任意结论 = 真（爆炸原理）
        return 1;
    },
    // ─── EQUIVALENCE ────────────────────────────────────
    /** 三元等价：A ↔ B */
    equiv(a, b) {
        if (a === b) {
            if (a === 0)
                return 0; // 两个都未知 → 未知
            return 1; // 两个都确定且相同 → 真
        }
        if (a === 0 || b === 0)
            return 0; // 任一未知 → 未知
        return -1; // 确定但不同 → 假
    },
    // ─── MAJORITY ──────────────────────────────────────
    /** 三输入多数表决 */
    majority(a, b, c) {
        // K3 多数表决：只有某类确定值严格超过"对方+未知"才确定
        const vals = [a, b, c];
        const pos = vals.filter(v => v === 1).length;
        const neg = vals.filter(v => v === -1).length;
        const unk = vals.filter(v => v === 0).length;
        if (pos > neg + unk)
            return 1; // +1 占绝对多数
        if (neg > pos + unk)
            return -1; // -1 占绝对多数
        return 0; // 不确定
    },
    // ─── CONSENSUS ──────────────────────────────────────
    /**
     * 多输入共识判定
     * @returns verdict=抉择方向, strength=共识强度(0~1)
     */
    consensus(values) {
        const sum = values.reduce((s, v) => s + v, 0);
        const strength = values.length > 0 ? Math.abs(sum) / values.length : 0;
        const verdict = sum > 0 ? 1 : sum < 0 ? -1 : 0;
        return { verdict, strength };
    },
};
export default K3;
export { K3 };
//# sourceMappingURL=k3.js.map