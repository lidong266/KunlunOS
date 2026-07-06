/**
 * 三进制状态机 — 所有状态转移基于 Trit 判定
 *
 * 替代传统的布尔状态机：
 *   旧: if (condition) { state = A } else { state = B }
 *   新: 基于 Trit 的三分支转移
 */
export class TernaryStateMachine {
    currentState;
    transitions = new Map();
    history = [];
    constructor(initialState) {
        this.currentState = initialState;
    }
    /**
     * 注册三元转移规则
     * @param from 当前状态
     * @param onTrue     signal = +1 时转移的目标
     * @param onUnknown  signal =  0 时转移的目标
     * @param onFalse    signal = -1 时转移的目标
     */
    registerTransition(from, onTrue, onUnknown, onFalse) {
        this.transitions.set(from, [onTrue, onUnknown, onFalse]);
    }
    /**
     * 批量注册转移规则
     */
    registerTransitions(entries) {
        for (const { from, onTrue, onUnknown, onFalse } of entries) {
            this.registerTransition(from, onTrue, onUnknown, onFalse);
        }
    }
    /**
     * 基于 Trit 信号的转移
     * @returns 新的当前状态
     * @throws 如果当前状态没有注册转移规则
     */
    transition(signal) {
        const trans = this.transitions.get(this.currentState);
        if (!trans) {
            throw new Error(`TernaryStateMachine: No transition registered from state "${this.currentState}". ` +
                `Use registerTransition() to define rules for this state.`);
        }
        const [onTrue, onUnknown, onFalse] = trans;
        const nextState = signal === 1 ? onTrue : signal === -1 ? onFalse : onUnknown;
        this.history.push({
            from: this.currentState,
            to: nextState,
            signal,
            timestamp: Date.now(),
        });
        this.currentState = nextState;
        return nextState;
    }
    /** 获取当前状态 */
    getState() {
        return this.currentState;
    }
    /** 获取转移历史 */
    getHistory() {
        return this.history;
    }
    /** 检查某状态是否有注册转移规则 */
    hasTransition(from) {
        return this.transitions.has(from);
    }
    /** 获取某状态的三条转移规则 */
    getTransition(from) {
        return this.transitions.get(from);
    }
    /** 重置到初始状态 */
    reset(initialState) {
        this.currentState = initialState;
        this.history = [];
    }
}
//# sourceMappingURL=ternary-state-machine.js.map