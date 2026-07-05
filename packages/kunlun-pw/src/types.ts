/**
 * kunlun-pw — L7 持久战策略引擎
 *
 * 四论之论持久战：防御→相持→反攻三阶段策略管理
 * 时间维度是内建的——渐进是算法本身。
 */

import type { Trit } from '@kunlun/ternary';
import type { ContradictionPair } from '@kunlun/contradiction';

// ═══════════════════════════════════════════════════════════════
// 核心类型
// ═══════════════════════════════════════════════════════════════

/** 持久战三阶段 */
export type ProtractedWarPhase = 'defense' | 'stalemate' | 'counteroffensive';

/** 阶段↔Trit 映射（防御=-1 相持=0 反攻=+1） */
export const PW_TRIT: Record<ProtractedWarPhase, Trit> = {
  defense: -1,
  stalemate: 0,
  counteroffensive: 1,
};

// ─── 持久战上下文 ───

export interface PWContext {
  /** 系统运行总时长 (ms) */
  totalRuntime: number;
  /** 当前阶段持续时间 (ms) */
  currentPhaseDuration: number;
  /** 阶段转换历史 */
  phaseHistory: PhaseHistoryEntry[];
  /** 力量对比快照 */
  powerSnapshot: PowerSnapshot;
  /** 活跃的矛盾对 */
  activeContradictions: ContradictionPair[];
  /** 实践螺旋现状 */
  spiralMetrics: SpiralMetrics;
  /** 外部事件时间线 */
  criticalEvents: PWCriticalEvent[];
}

export interface PhaseHistoryEntry {
  phase: ProtractedWarPhase;
  enteredAt: Date;
  exitedAt?: Date;
  duration: number;
  keyEvents: string[];
}

export interface PowerSnapshot {
  /** 我方能力评估（键值对） */
  capabilities: Record<string, number>; // 0~1
  /** 对方能力评估 */
  opponentCapabilities: Record<string, number>;
  /** 相对力量比（我方/对方），>1 为优势 */
  relativeStrengthRatio: number;
  /** 趋势：最近 N 个周期的力量比变化 */
  strengthTrend: number[]; // 滑动窗口
}

export interface SpiralMetrics {
  /** 总螺旋周期数 */
  totalCycles: number;
  /** 最近周期的上升/持平/退步比例 */
  recentAscensionRatio: {
    ascension: number;
    flat: number;
    regression: number;
  };
  /** 实践突破事件 */
  recentBreakthroughs: string[];
}

export interface PWCriticalEvent {
  timestamp: Date;
  description: string;
  impact: Trit; // +1=有利 -1=不利 0=中性
  domain: string;
}

// ─── 阶段评估 ───

export interface PhaseAssessment {
  /** 当前阶段 */
  currentPhase: ProtractedWarPhase;

  /** 力量对比评估 */
  powerBalance: PowerBalance;

  /** 矛盾态势 */
  contradictionStatus: ContradictionStatus;

  /** 实践螺旋的状态 */
  practiceSpiralStatus: PracticeSpiralStatus;

  /** 外部生态 */
  ecosystemFactors: EcosystemFactors;

  /** 阶段转换的准备度 */
  readinessToShift: ReadinessToShift;
}

export interface PowerBalance {
  /** +1=优势 0=均衡 -1=劣势 */
  relativeStrength: Trit;
  /** +1=增强 0=持平 -1=减弱 */
  strengthTrend: Trit;
  /** 关键能力评估 */
  capabilities: Record<string, Trit>;
}

export interface ContradictionStatus {
  /** 主要矛盾是否接近转化点 */
  approachingResolution: Trit;
  /** 新的主要矛盾是否在涌现 */
  newContradictionsEmerging: Trit;
}

export interface PracticeSpiralStatus {
  /** 实践-认识循环是否在上升 */
  spiralAscending: Trit;
  /** 最近的实践突破 */
  recentBreakthroughs: string[];
}

export interface EcosystemFactors {
  /** 外部环境是否有利 */
  favorability: Trit;
  /** 关键外部事件 */
  criticalEvents: string[];
}

export interface ReadinessToShift {
  /** 从防御→相持的准备度 */
  toStalemate: Trit;
  /** 从相持→反攻的准备度 */
  toCounteroffensive: Trit;
}

// ─── 阶段转换 ───

export interface PhaseShiftDecision {
  /** +1=应该转换 0=再观察 -1=不应转换 */
  shouldShift: Trit;
  /** 建议的目标阶段 */
  targetPhase?: ProtractedWarPhase;
  /** 转换的理由 */
  reasoning: string[];
  /** 转换的风险 */
  risks: PhaseShiftRisk[];
}

export interface PhaseShiftRisk {
  description: string;
  severity: Trit; // +1=高风险 0=中等 -1=低风险
}

export interface PhaseShiftResult {
  from: ProtractedWarPhase;
  to: ProtractedWarPhase;
  timestamp: Date;
  /** +1=计划内 0=加速 -1=被迫 */
  abruptness: Trit;
  /** 转换后的初始策略 */
  initialStrategy: string[];
}

// ─── 战术类型 ───

export interface DefenseTactics {
  /** +1=积极防御(运动战) 0=阵地防御 -1=消极防御 */
  activeDefense: Trit;
  specificTactics: string[];
}

export interface StalemateTactics {
  /** 0~1，1=纯消耗，0=纯发展 */
  attritionEmphasis: number;
  specificTactics: string[];
}

export interface CounteroffensiveTactics {
  /** +1=全面反攻 0=重点突破 -1=局部试探 */
  fullScale: Trit;
  specificTactics: string[];
}

// ─── 节奏调控 ───

export interface PWTempoMetrics {
  /** 当前阶段的持续时间 (ms) */
  phaseDuration: number;
  /** 最近一段时间的力量比变化率 */
  strengthChangeRate: number;
  /** 近期的实践螺旋频率 */
  spiralFrequency: number; // cycles per period
  /** 外部事件密度 */
  criticalEventDensity: number;
}

export interface TempoDecision {
  /** +1=加速(主动出击) 0=维持(相持消耗) -1=减速(保存实力) */
  direction: Trit;
  /** 行动建议 */
  actions: TempoAction[];
  /** 资源分配 */
  resourceAllocation: ResourceAllocation;
}

export interface TempoAction {
  description: string;
  type: 'offensive' | 'defensive' | 'guerrilla' | 'positional' | 'mobile';
  urgency: Trit; // +1=急迫 0=正常 -1=可推迟
  expectedEffect: string;
}

export interface ResourceAllocation {
  offense: number; // 0~1
  defense: number; // 0~1
  development: number; // 0~1
}

// ─── 全局状态 ───

export interface PWGlobalState {
  phases: PhaseRecord[];
  currentPhase: ProtractedWarPhase;
  totalDuration: number; // ms
  phaseTransitionCount: number;
}

export interface PhaseRecord {
  phase: ProtractedWarPhase;
  enteredAt: Date;
  exitedAt?: Date;
  duration: number;
  keyEvents: string[];
  powerBalanceSnapshot: Record<string, number>;
}
