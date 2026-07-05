/**
 * 7. 统一条件推导器 (Unification Conditions Deriver)
 *
 * 系统性地推导对立双方统一的必要条件和充分条件。
 * 核心算法：
 *   - 从正反题的命题属性推导必要条件（内部、外部、时间、结构、信息五类）
 *   - 通过矛盾类型和历史趋势评估条件满足度
 *   - 构建最优条件组合（最小代价路径）
 *   - 计算最小统一代价
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionHistory,
  UnificationConditions,
  UnificationCondition,
} from '../types';

export interface UnificationConditionsDeriver {
  derive(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): UnificationConditions;
}

export function createUnificationConditionsDeriver(): UnificationConditionsDeriver {
  return new UnificationConditionsDeriverImpl();
}

class UnificationConditionsDeriverImpl implements UnificationConditionsDeriver {
  derive(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): UnificationConditions {
    const necessary = this.deriveNecessaryConditions(contradiction, history);
    const sufficient = this.deriveSufficientConditions(contradiction, history);

    const evaluatedNecessary = this.evaluateConditions(necessary, contradiction, history);
    const evaluatedSufficient = this.evaluateConditions(sufficient, contradiction, history);

    const unifiable = this.judgeUnifiability(evaluatedNecessary, evaluatedSufficient);
    const optimal = this.selectOptimalConditions(evaluatedNecessary, evaluatedSufficient);
    const minCost = this.calculateMinimumCost(optimal, evaluatedNecessary, evaluatedSufficient);

    return {
      contradictionId: contradiction.id,
      unifiable,
      necessaryConditions: evaluatedNecessary,
      sufficientConditions: evaluatedSufficient,
      optimalConditionSet: optimal.map(c => c.description),
      minimumCost: Math.round(minCost * 100) / 100,
    };
  }

  // ─── 必要条件推导 ───

  private deriveNecessaryConditions(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): UnificationCondition[] {
    const conditions: UnificationCondition[] = [];
    const isAntagonistic = contradiction.contradictionType === 'antagonistic';

    conditions.push({
      description: '正反题必须在基本事实层面达成一致——即承认共同的观测数据',
      type: 'internal',
      satisfactionLevel: this.estimateFactAgreement(contradiction),
      controllable: true,
      estimatedTimeToFulfill: null,
    });

    conditions.push({
      description: '双方必须具备沟通意愿和沟通渠道',
      type: 'internal',
      satisfactionLevel: isAntagonistic ? 0.2 : 0.6,
      controllable: true,
      estimatedTimeToFulfill: isAntagonistic ? 7 * 24 * 3600 * 1000 : null,
    });

    conditions.push({
      description: '矛盾不能是零和结构——双方的核心诉求必须存在非排他的可能',
      type: 'structural',
      satisfactionLevel: isAntagonistic ? this.estimateZeroSumDegree(contradiction) : 0.8,
      controllable: false,
      estimatedTimeToFulfill: null,
    });

    if (history.states.length >= 2) {
      const escalation = this.detectEscalation(history);
      if (escalation) {
        conditions.push({
          description: '矛盾升级趋势必须被遏制——需要降级窗口',
          type: 'temporal',
          satisfactionLevel: 0.3,
          controllable: true,
          estimatedTimeToFulfill: 3 * 24 * 3600 * 1000,
        });
      }
    }

    const evidenceBalance = this.assessEvidenceBalance(contradiction);
    if (Math.abs(evidenceBalance) > 0.5) {
      conditions.push({
        description: '证据严重失衡的一方需要补充对等的信息获取能力',
        type: 'information',
        satisfactionLevel: 1 - Math.abs(evidenceBalance),
        controllable: true,
        estimatedTimeToFulfill: Math.abs(evidenceBalance) > 0.7
          ? 14 * 24 * 3600 * 1000
          : 5 * 24 * 3600 * 1000,
      });
    }

    return conditions;
  }

  // ─── 充分条件推导 ───

  private deriveSufficientConditions(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): UnificationCondition[] {
    const conditions: UnificationCondition[] = [];
    const isAntagonistic = contradiction.contradictionType === 'antagonistic';

    conditions.push({
      description: '存在双方认可的中立第三方或外部框架作为统一参照',
      type: 'external',
      satisfactionLevel: 0.5,
      controllable: true,
      estimatedTimeToFulfill: 3 * 24 * 3600 * 1000,
    });

    if (isAntagonistic) {
      conditions.push({
        description: '对抗性矛盾需要转化为非对抗性矛盾后才能统一',
        type: 'structural',
        satisfactionLevel: 0.1,
        controllable: false,
        estimatedTimeToFulfill: 30 * 24 * 3600 * 1000,
      });
      conditions.push({
        description: '对立双方的核心理念需要找到更高的共同价值框架',
        type: 'structural',
        satisfactionLevel: 0.15,
        controllable: true,
        estimatedTimeToFulfill: 14 * 24 * 3600 * 1000,
      });
    }

    const tEvidence = contradiction.thesis.evidence.length;
    const aEvidence = contradiction.antithesis.evidence.length;
    if (tEvidence < 3 && aEvidence < 3) {
      conditions.push({
        description: '双方都需要补充充分的证据来支撑各自的命题',
        type: 'information',
        satisfactionLevel: Math.min(tEvidence, aEvidence) / 3,
        controllable: true,
        estimatedTimeToFulfill: 5 * 24 * 3600 * 1000,
      });
    }

    if (history.states.length >= 2) {
      if (this.detectStabilisation(history)) {
        conditions.push({
          description: '矛盾趋于稳定，满足实现统一的窗口期条件',
          type: 'temporal',
          satisfactionLevel: 0.7,
          controllable: false,
          estimatedTimeToFulfill: null,
        });
      }
    }

    conditions.push({
      description: '正反题的统合方案必须同时满足双方的核心关切（非零和解决）',
      type: 'internal',
      satisfactionLevel: this.estimateIntegrationFeasibility(contradiction),
      controllable: true,
      estimatedTimeToFulfill: 10 * 24 * 3600 * 1000,
    });

    return conditions;
  }

  // ─── 条件评估 ───

  private evaluateConditions(
    conditions: UnificationCondition[],
    _contradiction: ContradictionPair,
    _history: ContradictionHistory
  ): UnificationCondition[] {
    // satisfactionLevel 已在构造时计算，此处按需微调
    return conditions.map(c => ({
      ...c,
      satisfactionLevel: Math.round(Math.min(1, Math.max(0, c.satisfactionLevel)) * 100) / 100,
    }));
  }

  // ─── 统一可能性判定 ───

  private judgeUnifiability(
    necessary: UnificationCondition[],
    sufficient: UnificationCondition[]
  ): Trit {
    if (necessary.length === 0) return 0;

    // 必要条件平均满足度
    const necAvg = necessary.reduce((sum, c) => sum + c.satisfactionLevel, 0) / necessary.length;

    // 任何必要条件满足度 < 0.2 → 不可统一
    if (necessary.some(c => c.satisfactionLevel < 0.2)) return -1;

    // 必要条件平均 < 0.4 → 不可统一
    if (necAvg < 0.4) return -1;

    // 充分条件平均满足度
    const sufAvg = sufficient.length > 0
      ? sufficient.reduce((sum, c) => sum + c.satisfactionLevel, 0) / sufficient.length
      : 0.5;

    const combinedScore = necAvg * 0.6 + sufAvg * 0.4;

    if (combinedScore >= 0.7) return 1;  // 可统一
    if (combinedScore >= 0.45) return 0; // 条件性统一
    return -1; // 不可统一
  }

  // ─── 最优条件选择 ───

  private selectOptimalConditions(
    necessary: UnificationCondition[],
    sufficient: UnificationCondition[]
  ): UnificationCondition[] {
    // 最优组合 = 满足度最低的必要条件（优先解决瓶颈） + 满足度最高的充分条件
    const sortedNec = [...necessary].sort((a, b) => a.satisfactionLevel - b.satisfactionLevel);
    const sortedSuf = [...sufficient].sort((a, b) => b.satisfactionLevel - a.satisfactionLevel);

    // 选择最低的 3 个必要条件和最高的 2 个充分条件
    const topBottlenecks = sortedNec.slice(0, Math.min(3, sortedNec.length));
    const topSufficient = sortedSuf.slice(0, Math.min(2, sortedSuf.length));

    return [...topBottlenecks, ...topSufficient];
  }

  // ─── 最小代价计算 ───

  private calculateMinimumCost(
    optimal: UnificationCondition[],
    necessary: UnificationCondition[],
    sufficient: UnificationCondition[]
  ): number {
    const allConditions = [...necessary, ...sufficient];
    if (allConditions.length === 0) return 0;

    // 代价 = Σ(1 - satisfactionLevel) / count × 可控性权重
    return allConditions.reduce((sum, c) => {
      const baseCost = 1 - c.satisfactionLevel;
      const controlPenalty = c.controllable ? 1 : 1.5; // 不可控条件代价更高
      return sum + baseCost * controlPenalty;
    }, 0) / allConditions.length;
  }

  // ─── 辅助方法 ───

  /** 估算正反题在事实层面的共识度 */
  private estimateFactAgreement(contradiction: ContradictionPair): number {
    const { thesis, antithesis } = contradiction;

    // 证据来源重叠度
    const thesisSources = new Set(thesis.evidence.map(e => e.source));
    const antithesisSources = new Set(antithesis.evidence.map(e => e.source));
    const overlap = [...thesisSources].filter(s => antithesisSources.has(s)).length;
    const totalSources = thesisSources.size + antithesisSources.size;

    const sourceOverlap = totalSources > 0 ? (2 * overlap) / totalSources : 0;

    // 信度相近度（Trit 差值越小越共识）
    const confDiff = Math.abs(thesis.confidenceTrit - antithesis.confidenceTrit);
    const confAgreement = 1 - confDiff / 2; // Trit 差最大 2

    // 领域一致性
    const domainMatch = thesis.domain === antithesis.domain ? 1 : 0.5;

    return Math.round((sourceOverlap * 0.4 + confAgreement * 0.4 + domainMatch * 0.2) * 100) / 100;
  }

  /** 估算零和程度：对抗性越高越零和 */
  private estimateZeroSumDegree(contradiction: ContradictionPair): number {
    const isAntagonistic = contradiction.contradictionType === 'antagonistic';
    // 对抗性矛盾默认高零和，非对抗性默认低零和
    const base = isAntagonistic ? 0.2 : 0.8; // 注意这里返回值是非零和程度

    // 关联矛盾数量多 → 非零和可能性稍大
    const relationBonus = Math.min(0.2, contradiction.relatedContradictions.length * 0.05);

    return Math.round((base + relationBonus) * 100) / 100;
  }

  /** 检测矛盾升级趋势（连续2次以上力量差异扩大） */
  private detectEscalation(history: ContradictionHistory): boolean {
    const states = history.states;
    if (states.length < 3) return false;

    let escalating = 0;
    for (let i = 1; i < states.length; i++) {
      const prevDiff = Math.abs(states[i - 1].thesisStrength - states[i - 1].antithesisStrength);
      const currDiff = Math.abs(states[i].thesisStrength - states[i].antithesisStrength);
      if (currDiff > prevDiff + 0.03) escalating++;
      else escalating = 0;
      if (escalating >= 2) return true;
    }
    return false;
  }

  /** 检测矛盾稳定化趋势 */
  private detectStabilisation(history: ContradictionHistory): boolean {
    const states = history.states;
    if (states.length < 4) return false;

    const recent = states.slice(-4);
    const diffs = recent.map(s =>
      Math.abs(s.thesisStrength - s.antithesisStrength)
    );

    // 标准差小 → 稳定
    const mean = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / diffs.length;
    return Math.sqrt(variance) < 0.08;
  }

  /** 评估证据平衡度：+1 = thesis 证据严重偏多，-1 = antithesis 偏多 */
  private assessEvidenceBalance(contradiction: ContradictionPair): number {
    const tTotal = contradiction.thesis.evidence.length + contradiction.thesis.counterEvidence.length;
    const aTotal = contradiction.antithesis.evidence.length + contradiction.antithesis.counterEvidence.length;

    if (tTotal + aTotal === 0) return 0;

    const tSupport = contradiction.thesis.evidence.reduce((s, e) => s + (e.strength + 1) / 2, 0);
    const aSupport = contradiction.antithesis.evidence.reduce((s, e) => s + (e.strength + 1) / 2, 0);

    const maxSupport = Math.max(tTotal, aTotal, 1);
    return (tSupport - aSupport) / maxSupport;
  }

  /** 估算综合方案的可行性 */
  private estimateIntegrationFeasibility(contradiction: ContradictionPair): number {
    const isAntagonistic = contradiction.contradictionType === 'antagonistic';
    const base = isAntagonistic ? 0.2 : 0.5;

    // 证据丰富度加分
    const evidenceBonus = Math.min(0.3,
      (contradiction.thesis.evidence.length + contradiction.antithesis.evidence.length) * 0.05
    );

    return Math.round(Math.min(1, base + evidenceBonus) * 100) / 100;
  }
}
