/**
 * ProtractedWarEngine — 持久战策略引擎
 *
 * 实现论持久战核心算法：三阶段识别、转换判断、战术生成、节奏调控。
 * 时间维度内建——渐进是算法本身。
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import {
  type ProtractedWarPhase,
  type PWContext,
  type PhaseAssessment,
  type PhaseShiftDecision,
  type PhaseShiftResult,
  type DefenseTactics,
  type StalemateTactics,
  type CounteroffensiveTactics,
  type PWTempoMetrics,
  type TempoDecision,
  type TempoAction,
  type ResourceAllocation,
  type PWGlobalState,
  type PhaseRecord,
  type PhaseHistoryEntry,
  type PowerBalance,
  type ContradictionStatus,
  type PracticeSpiralStatus,
  type EcosystemFactors,
  type ReadinessToShift,
  type PhaseShiftRisk,
  PW_TRIT,
} from './types.js';

// ═══════════════════════════════════════════════════════════════
// 引擎接口
// ═══════════════════════════════════════════════════════════════

export interface IProtractedWarEngine {
  /** 评估当前所处的持久战阶段 */
  assessPhase(context: PWContext): Promise<PhaseAssessment>;

  /** 判断是否满足阶段转换条件 */
  evaluatePhaseShift(current: PhaseAssessment): Promise<PhaseShiftDecision>;

  /** 执行阶段转换 */
  executePhaseShift(
    from: ProtractedWarPhase,
    to: ProtractedWarPhase,
  ): Promise<PhaseShiftResult>;

  /** 防御阶段战术 */
  defenseTactics(assessment: PhaseAssessment): Promise<DefenseTactics>;

  /** 相持阶段战术 */
  stalemateTactics(assessment: PhaseAssessment): Promise<StalemateTactics>;

  /** 反攻阶段战术 */
  counteroffensiveTactics(assessment: PhaseAssessment): Promise<CounteroffensiveTactics>;

  /** 持久战节奏引擎 */
  regulateTempo(
    phase: ProtractedWarPhase,
    metrics: PWTempoMetrics,
  ): Promise<TempoDecision>;

  /** 获取持久战全局状态 */
  getGlobalState(): PWGlobalState;
}

// ═══════════════════════════════════════════════════════════════
// 引擎实现
// ═══════════════════════════════════════════════════════════════

export class ProtractedWarEngine implements IProtractedWarEngine {
  private phaseHistory: PhaseRecord[] = [];
  private currentPhase: ProtractedWarPhase;
  private phaseTransitionCount = 0;
  private startupTime: Date;

  constructor() {
    this.startupTime = new Date();
    this.currentPhase = 'defense'; // 默认起始于防御阶段
  }

  // ─── 阶段评估 ───

  async assessPhase(context: PWContext): Promise<PhaseAssessment> {
    const powerBalance = this.evaluatePowerBalance(context);
    const contradictionStatus = this.evaluateContradictionStatus(context);
    const practiceSpiralStatus = this.evaluatePracticeSpiral(context);
    const ecosystemFactors = this.evaluateEcosystem(context);
    const readinessToShift = this.evaluateReadiness(
      powerBalance,
      contradictionStatus,
      practiceSpiralStatus,
    );

    // 基于力量对比和准备度推断当前阶段
    const inferredPhase = this.inferPhase(powerBalance, readinessToShift);

    return {
      currentPhase: inferredPhase,
      powerBalance,
      contradictionStatus,
      practiceSpiralStatus,
      ecosystemFactors,
      readinessToShift,
    };
  }

  // ─── 阶段转换决策 ───

  async evaluatePhaseShift(current: PhaseAssessment): Promise<PhaseShiftDecision> {
    const reasoning: string[] = [];
    const risks: PhaseShiftRisk[] = [];

    let shouldShift: Trit = T_UNKNOWN;
    let targetPhase: ProtractedWarPhase | undefined;

    switch (current.currentPhase) {
      case 'defense': {
        // 防御→相持的条件
        const readyForStalemate =
          current.readinessToShift.toStalemate === T_TRUE;
        const strengthImproving = current.powerBalance.strengthTrend === T_TRUE;

        if (readyForStalemate && strengthImproving) {
          shouldShift = T_TRUE;
          targetPhase = 'stalemate';
          reasoning.push('力量对比趋势改善，准备度达标');
          reasoning.push('防御阶段目标已达成：保存实力、创造战机');
        } else if (readyForStalemate || strengthImproving) {
          shouldShift = T_UNKNOWN;
          reasoning.push('部分条件满足，但尚不完全');
          risks.push({
            description: '单方面条件满足可能导致冒进',
            severity: T_TRUE,
          });
        } else {
          shouldShift = T_FALSE;
          reasoning.push('力量对比仍处于劣势，需继续防御');
        }
        break;
      }

      case 'stalemate': {
        const readyForCounteroffensive =
          current.readinessToShift.toCounteroffensive === T_TRUE;
        const strengthAdvantage =
          current.powerBalance.relativeStrength === T_TRUE;
        const contradictionApproaching =
          current.contradictionStatus.approachingResolution === T_TRUE;

        if (readyForCounteroffensive && strengthAdvantage && contradictionApproaching) {
          shouldShift = T_TRUE;
          targetPhase = 'counteroffensive';
          reasoning.push('力量对比逆转，矛盾接近转化点');
          reasoning.push('相持阶段目标已达成：消耗对方、发展自己');
        } else if (!strengthAdvantage && readyForCounteroffensive) {
          shouldShift = T_UNKNOWN;
          reasoning.push('准备度达标但力量对比未逆转');
          risks.push({
            description: '力量不足时过早反攻可能导致消耗战延长',
            severity: T_TRUE,
          });
        } else if (
          current.powerBalance.relativeStrength === T_FALSE &&
          current.powerBalance.strengthTrend === T_FALSE
        ) {
          // 力量下降 → 可能退回防御
          shouldShift = T_TRUE;
          targetPhase = 'defense';
          reasoning.push('力量持续下降，战略退却以保存实力');
          risks.push({
            description: '退却可能打击士气，需谨慎管理',
            severity: T_UNKNOWN,
          });
        } else {
          shouldShift = T_FALSE;
          reasoning.push('力量平衡仍需消耗对方，继续相持');
        }
        break;
      }

      case 'counteroffensive': {
        const strengthDominant =
          current.powerBalance.relativeStrength === T_TRUE;
        const contradictionResolving =
          current.contradictionStatus.approachingResolution === T_TRUE;

        if (strengthDominant && contradictionResolving) {
          shouldShift = T_TRUE;
          // 反攻成功后进入新周期的防御（新的主要矛盾出现）
          if (current.contradictionStatus.newContradictionsEmerging === T_TRUE) {
            targetPhase = 'defense';
            reasoning.push('反攻阶段目标达成，新矛盾涌现');
            reasoning.push('开启新一轮持久战——螺旋上升');
          } else {
            shouldShift = T_FALSE;
            reasoning.push('反攻持续推进中，新矛盾尚未涌现');
          }
        } else if (!strengthDominant) {
          shouldShift = T_FALSE;
          reasoning.push('力量优势未稳固，继续巩固');
        } else {
          shouldShift = T_FALSE;
          reasoning.push('矛盾尚未完全转化，持续反攻');
        }
        break;
      }
    }

    return { shouldShift, targetPhase, reasoning, risks };
  }

  // ─── 阶段转换执行 ───

  async executePhaseShift(
    from: ProtractedWarPhase,
    to: ProtractedWarPhase,
  ): Promise<PhaseShiftResult> {
    const now = new Date();
    const abruptness = this.computeAbruptness(from, to);

    // 记录旧阶段结束
    const lastPhase = this.phaseHistory[this.phaseHistory.length - 1];
    if (lastPhase && !lastPhase.exitedAt) {
      lastPhase.exitedAt = now;
      lastPhase.duration = now.getTime() - lastPhase.enteredAt.getTime();
    }

    // 记录新阶段
    const initialStrategy = this.generateInitialStrategy(to);
    const newPhase: PhaseRecord = {
      phase: to,
      enteredAt: now,
      duration: 0,
      keyEvents: [`从${from}转换为${to}`],
      powerBalanceSnapshot: {},
    };
    this.phaseHistory.push(newPhase);
    this.currentPhase = to;
    this.phaseTransitionCount++;

    return {
      from,
      to,
      timestamp: now,
      abruptness,
      initialStrategy,
    };
  }

  // ─── 防御阶段战术 ───

  async defenseTactics(assessment: PhaseAssessment): Promise<DefenseTactics> {
    const strengthTrend = assessment.powerBalance.strengthTrend;

    // 积极防御条件：力量趋势上升 + 螺旋上升
    const canActiveDefend =
      strengthTrend === T_TRUE &&
      assessment.practiceSpiralStatus.spiralAscending === T_TRUE;

    const activeDefense: Trit = canActiveDefend
      ? T_TRUE
      : strengthTrend === T_FALSE
        ? T_FALSE
        : T_UNKNOWN;

    const tactics: string[] = [];
    if (canActiveDefend) {
      tactics.push('运动战：灵活移动，创造局部优势');
      tactics.push('保存核心力量，消耗对方有生力量');
      tactics.push('利用实践螺旋提炼的规律指导战术选择');
    } else if (strengthTrend === T_FALSE) {
      tactics.push('战略性退却：保存实力为第一要务');
      tactics.push('避免正面决战，寻找战机');
    } else {
      tactics.push('阵地防御：固守关键节点');
      tactics.push('等待力量对比改善的信号');
    }

    return { activeDefense, specificTactics: tactics };
  }

  // ─── 相持阶段战术 ───

  async stalemateTactics(assessment: PhaseAssessment): Promise<StalemateTactics> {
    const relativeStrength = assessment.powerBalance.relativeStrength;

    // 力量越强，越应该发展；力量越弱，越应该消耗
    let attritionEmphasis: number;
    if (relativeStrength === T_TRUE) {
      attritionEmphasis = 0.3; // 发展为主
    } else if (relativeStrength === T_FALSE) {
      attritionEmphasis = 0.7; // 消耗为主
    } else {
      attritionEmphasis = 0.5; // 均衡
    }

    const tactics: string[] = [];
    tactics.push('游击战：骚扰消耗，零敲碎打');
    tactics.push('发展战：加速实践螺旋，积累认知增量');
    tactics.push('阵地战：固守已获得的阵地，逐步推进');

    return { attritionEmphasis, specificTactics: tactics };
  }

  // ─── 反攻阶段战术 ───

  async counteroffensiveTactics(
    assessment: PhaseAssessment,
  ): Promise<CounteroffensiveTactics> {
    const relativeStrength = assessment.powerBalance.relativeStrength;
    const contradictionResolving =
      assessment.contradictionStatus.approachingResolution;

    // 全面反攻条件：力量绝对优势 + 矛盾接近转化
    const canFullScale =
      relativeStrength === T_TRUE && contradictionResolving === T_TRUE;

    const fullScale: Trit = canFullScale
      ? T_TRUE
      : relativeStrength === T_TRUE
        ? T_UNKNOWN
        : T_FALSE;

    const tactics: string[] = [];
    if (canFullScale) {
      tactics.push('全面反攻：多线出击，夺取决定性胜利');
      tactics.push('将实践螺旋认识转化为大规模行动');
    } else if (relativeStrength === T_TRUE) {
      tactics.push('重点突破：选择最弱点集中力量');
      tactics.push('巩固已夺取的阵地');
    } else {
      tactics.push('局部试探：小规模行动验证力量对比');
    }

    return { fullScale, specificTactics: tactics };
  }

  // ─── 节奏调控 ───

  async regulateTempo(
    phase: ProtractedWarPhase,
    metrics: PWTempoMetrics,
  ): Promise<TempoDecision> {
    let direction: Trit;
    const actions: TempoAction[] = [];
    let resourceAllocation: ResourceAllocation;

    switch (phase) {
      case 'defense': {
        // 防御阶段：减速保存
        direction = metrics.strengthChangeRate > 0.1 ? T_UNKNOWN : T_FALSE;
        actions.push({
          description: '降低行动频率，保存有生力量',
          type: 'defensive',
          urgency: T_TRUE,
          expectedEffect: '避免力量过度消耗',
        });
        resourceAllocation = { offense: 0.1, defense: 0.7, development: 0.2 };
        break;
      }
      case 'stalemate': {
        // 相持阶段：根据力量变化率调节
        if (metrics.strengthChangeRate > 0.2) {
          direction = T_TRUE;
          resourceAllocation = { offense: 0.3, defense: 0.3, development: 0.4 };
          actions.push({
            description: '力量增长明显，可适度加快节奏',
            type: 'mobile',
            urgency: T_UNKNOWN,
            expectedEffect: '加速力量积累',
          });
        } else if (metrics.strengthChangeRate < -0.1) {
          direction = T_FALSE;
          resourceAllocation = { offense: 0.1, defense: 0.6, development: 0.3 };
          actions.push({
            description: '力量下降，减缓节奏保存实力',
            type: 'defensive',
            urgency: T_TRUE,
            expectedEffect: '防止力量继续下降',
          });
        } else {
          direction = T_UNKNOWN;
          resourceAllocation = { offense: 0.2, defense: 0.4, development: 0.4 };
          actions.push({
            description: '维持现有节奏，耐心消耗',
            type: 'positional',
            urgency: T_UNKNOWN,
            expectedEffect: '稳步发展',
          });
        }
        break;
      }
      case 'counteroffensive': {
        // 反攻阶段：加速
        direction = T_TRUE;
        resourceAllocation = { offense: 0.6, defense: 0.2, development: 0.2 };
        actions.push({
          description: '加速进攻节奏，扩大战果',
          type: 'offensive',
          urgency: T_TRUE,
          expectedEffect: '夺取决定性胜利',
        });
        if (metrics.spiralFrequency > 3) {
          actions.push({
            description: '实践螺旋高频，可转化为战术优势',
            type: 'mobile',
            urgency: T_TRUE,
            expectedEffect: '将认知优势转化为行动优势',
          });
        }
        break;
      }
    }

    return { direction, actions, resourceAllocation };
  }

  // ─── 全局状态 ───

  getGlobalState(): PWGlobalState {
    const now = Date.now();
    return {
      phases: this.phaseHistory.map((p) => ({
        ...p,
        duration: p.exitedAt
          ? p.exitedAt.getTime() - p.enteredAt.getTime()
          : now - p.enteredAt.getTime(),
      })),
      currentPhase: this.currentPhase,
      totalDuration: now - this.startupTime.getTime(),
      phaseTransitionCount: this.phaseTransitionCount,
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 私有评估方法
  // ═════════════════════════════════════════════════════════════

  private evaluatePowerBalance(context: PWContext): PowerBalance {
    const { powerSnapshot } = context;
    const ratio = powerSnapshot.relativeStrengthRatio ?? 1.0;

    const relativeStrength: Trit = ratio > 1.3
      ? T_TRUE
      : ratio < 0.7
        ? T_FALSE
        : T_UNKNOWN;

    // 从滑动窗口判断趋势
    const trend = powerSnapshot.strengthTrend ?? [];
    let strengthTrend: Trit = T_UNKNOWN;
    if (trend.length >= 2) {
      const recent = trend.slice(-3);
      const increasing = recent.filter(
        (_: number, i: number, arr: number[]) => i > 0 && arr[i]! > arr[i - 1]!,
      ).length;
      const decreasing = recent.filter(
        (_: number, i: number, arr: number[]) => i > 0 && arr[i]! < arr[i - 1]!,
      ).length;
      if (increasing > decreasing) strengthTrend = T_TRUE;
      else if (decreasing > increasing) strengthTrend = T_FALSE;
    }

    // 关键能力 Trit 化
    const caps = powerSnapshot.capabilities ?? {};
    const capabilities: Record<string, Trit> = {};
    for (const [key, val] of Object.entries(caps)) {
      capabilities[key] = val > 0.7 ? T_TRUE : val < 0.3 ? T_FALSE : T_UNKNOWN;
    }

    return { relativeStrength, strengthTrend, capabilities };
  }

  private evaluateContradictionStatus(context: PWContext): ContradictionStatus {
    const contradictions = context.activeContradictions;
    return {
      approachingResolution:
        contradictions.length > 0 && contradictions.some((c) => c.contradictionType === 'non_antagonistic')
          ? T_TRUE
          : T_UNKNOWN,
      newContradictionsEmerging:
        contradictions.length > 2 ? T_TRUE : T_FALSE,
    };
  }

  private evaluatePracticeSpiral(context: PWContext): PracticeSpiralStatus {
    const metrics = context.spiralMetrics;
    const ratio = metrics.recentAscensionRatio ?? { ascension: 0, flat: 1, regression: 0 };
    const total = ratio.ascension + ratio.flat + ratio.regression;
    const ascensionRate = total > 0 ? ratio.ascension / total : 0;

    return {
      spiralAscending:
        ascensionRate > 0.5
          ? T_TRUE
          : ascensionRate < 0.2
            ? T_FALSE
            : T_UNKNOWN,
      recentBreakthroughs: metrics.recentBreakthroughs,
    };
  }

  private evaluateEcosystem(context: PWContext): EcosystemFactors {
    const events = context.criticalEvents;
    const recentEvents = events.filter(
      (e) => Date.now() - new Date(e.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000, // 近7天
    );

    const favorableCount = recentEvents.filter((e) => e.impact === 1).length;
    const unfavorableCount = recentEvents.filter((e) => e.impact === -1).length;

    return {
      favorability:
        favorableCount > unfavorableCount
          ? T_TRUE
          : unfavorableCount > favorableCount
            ? T_FALSE
            : T_UNKNOWN,
      criticalEvents: recentEvents.map((e) => e.description),
    };
  }

  private evaluateReadiness(
    power: PowerBalance,
    contradiction: ContradictionStatus,
    spiral: PracticeSpiralStatus,
  ): ReadinessToShift {
    // 防御→相持：力量趋势改善 + 螺旋上升 + 矛盾在演化
    const toStalemate: Trit =
      power.strengthTrend === T_TRUE &&
      spiral.spiralAscending === T_TRUE
        ? T_TRUE
        : power.strengthTrend === T_FALSE
          ? T_FALSE
          : T_UNKNOWN;

    // 相持→反攻：力量优势 + 矛盾接近转化 + 螺旋上升
    const toCounteroffensive: Trit =
      power.relativeStrength === T_TRUE &&
      contradiction.approachingResolution === T_TRUE
        ? T_TRUE
        : power.relativeStrength === T_FALSE
          ? T_FALSE
          : T_UNKNOWN;

    return { toStalemate, toCounteroffensive };
  }

  private inferPhase(
    power: PowerBalance,
    readiness: ReadinessToShift,
  ): ProtractedWarPhase {
    // 如果力量劣势且不满足相持准备度 → 防御
    if (power.relativeStrength === T_FALSE && readiness.toStalemate !== T_TRUE) {
      return 'defense';
    }
    // 如果力量优势且满足反攻准备度 → 反攻
    if (power.relativeStrength === T_TRUE && readiness.toCounteroffensive === T_TRUE) {
      return 'counteroffensive';
    }
    // 否则为相持
    return 'stalemate';
  }

  private computeAbruptness(
    from: ProtractedWarPhase,
    to: ProtractedWarPhase,
  ): Trit {
    const fromVal = PW_TRIT[from];
    const toVal = PW_TRIT[to];
    const diff = toVal - fromVal;
    if (diff > 0) return T_TRUE; // 向前推进：计划内
    if (diff < 0) return T_FALSE; // 向后撤退：被迫
    return T_UNKNOWN; // 保持不变
  }

  private generateInitialStrategy(to: ProtractedWarPhase): string[] {
    switch (to) {
      case 'defense':
        return ['保存有生力量', '创造有利战机', '避免决战'];
      case 'stalemate':
        return ['持续消耗对方', '加速自我发展', '游击与运动战结合'];
      case 'counteroffensive':
        return ['集中优势兵力', '各个击破', '夺取关键节点'];
    }
  }
}
