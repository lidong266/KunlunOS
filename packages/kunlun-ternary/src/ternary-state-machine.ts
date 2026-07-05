import type { Trit } from './trit.js';

/**
 * 三进制状态机 — 所有状态转移基于 Trit 判定
 *
 * 替代传统的布尔状态机：
 *   旧: if (condition) { state = A } else { state = B }
 *   新: 基于 Trit 的三分支转移
 */
export class TernaryStateMachine<S extends string> {
  private currentState: S;
  private transitions: Map<S, [S, S, S]> = new Map();
  private history: Array<{ from: S; to: S; signal: Trit; timestamp: number }> = [];

  constructor(initialState: S) {
    this.currentState = initialState;
  }

  /**
   * 注册三元转移规则
   * @param from 当前状态
   * @param onTrue     signal = +1 时转移的目标
   * @param onUnknown  signal =  0 时转移的目标
   * @param onFalse    signal = -1 时转移的目标
   */
  registerTransition(from: S, onTrue: S, onUnknown: S, onFalse: S): void {
    this.transitions.set(from, [onTrue, onUnknown, onFalse]);
  }

  /**
   * 批量注册转移规则
   */
  registerTransitions(
    entries: Array<{ from: S; onTrue: S; onUnknown: S; onFalse: S }>
  ): void {
    for (const { from, onTrue, onUnknown, onFalse } of entries) {
      this.registerTransition(from, onTrue, onUnknown, onFalse);
    }
  }

  /**
   * 基于 Trit 信号的转移
   * @returns 新的当前状态
   * @throws 如果当前状态没有注册转移规则
   */
  transition(signal: Trit): S {
    const trans = this.transitions.get(this.currentState);
    if (!trans) {
      throw new Error(
        `TernaryStateMachine: No transition registered from state "${this.currentState}". ` +
        `Use registerTransition() to define rules for this state.`
      );
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
  getState(): S {
    return this.currentState;
  }

  /** 获取转移历史 */
  getHistory(): ReadonlyArray<{
    from: S;
    to: S;
    signal: Trit;
    timestamp: number;
  }> {
    return this.history;
  }

  /** 检查某状态是否有注册转移规则 */
  hasTransition(from: S): boolean {
    return this.transitions.has(from);
  }

  /** 获取某状态的三条转移规则 */
  getTransition(from: S): [S, S, S] | undefined {
    return this.transitions.get(from);
  }

  /** 重置到初始状态 */
  reset(initialState: S): void {
    this.currentState = initialState;
    this.history = [];
  }
}
