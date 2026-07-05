/**
 * kunlun-spiral — L8 实践螺旋引擎
 *
 * 四论之实践论：实践→认识→再实践→再认识螺旋
 * 替代 V1 的 IEvolutionEngine（双速进化）
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import type { Proposition, ContradictionPair } from '@kunlun/contradiction';

// ═══════════════════════════════════════════════════════════════
// 核心类型
// ═══════════════════════════════════════════════════════════════

/** 实践螺旋四阶段 */
export type SpiralPhase = 'practice' | 'cognition' | 'rePractice' | 'deepenCognition';

/**
 * 实践上下文 — 替代 V1 的 StrategyContext
 */
export interface PracticeContext {
  /** 实践领域 (F01-F11 十一桥) */
  domain: string;
  /** 待验证的命题/策略 */
  hypothesis: Proposition;
  /** 实践环境的描述 */
  environment: PracticeEnvironment;
  /** 关联的矛盾对 */
  relatedContradictions: ContradictionPair[];
}

export interface PracticeEnvironment {
  type: 'simulation' | 'production' | 'sandbox' | 'human_feedback';
  constraints: string[];
}

/** 阶段一输出：实践结果 */
export interface PracticeResult {
  /** +1=证实 0=需更多实践 -1=证伪 */
  verdict: Trit;
  /** 实践中涌现的新现象 */
  emergentObservations: string[];
  /** 实践中发现的新矛盾 */
  newContradictions: ContradictionPair[];
  /** 定量指标变化 */
  metrics: Record<string, PracticeMetric>;
  /** 意外后果 */
  unintendedConsequences: UnintendedConsequence[];
}

export interface PracticeMetric {
  before: number;
  after: number;
  change: Trit; // +1=改善 0=不变 -1=恶化
}

export interface UnintendedConsequence {
  description: string;
  impact: Trit; // +1=正面 0=中性 -1=负面
}

/** 阶段二输出：理论认识 */
export interface CognitionOutput {
  /** 从实践中提炼的规律 */
  principles: string[];
  /** +1=普遍适用 0=条件适用 -1=特例 */
  universality: Trit;
  /** 与原有理论的矛盾 */
  theoreticalContradictions: ContradictionPair[];
  /** 信度向量 */
  confidenceVector: Tryte;
}

/** 阶段三输出：再实践结果 */
export interface RePracticeResult {
  /** +1=确认 0=部分确认 -1=否定 */
  verification: Trit;
  /** 修正后的实践描述 */
  refinedPractice: string;
  /** 新涌现的矛盾 */
  newContradictions: ContradictionPair[];
}

/** 阶段四输出：深化再认识 */
export interface DeepenedCognition {
  /** 深化的认识 */
  deepenedPrinciples: string[];
  /** +1=上升 0=持平 -1=退步 */
  spiralAscension: Trit;
  /** 涌现的新属性 */
  emergentProperties: string[];
  /** 更新的信度向量 */
  updatedConfidenceVector: Tryte;
}

/**
 * 螺旋周期输出 — 替代 V1 的 SolidificationReport
 */
export interface SpiralCycleOutput {
  cycleId: string;
  cycleNumber: number;
  startedAt: Date;
  completedAt: Date;

  /** 四阶段结果 */
  phases: {
    practice: PracticeResult;
    cognition: CognitionOutput;
    rePractice: RePracticeResult;
    deepenedCognition: DeepenedCognition;
  };

  /** 螺旋的质量评估 */
  quality: SpiralQuality;

  /** 对持久战阶段的影响 */
  protractedWarImpact?: ProtractedWarImpact;
}

export interface SpiralQuality {
  /** 是否真正上升（而非原地打转） */
  genuineAscension: Trit;
  /** 新认识的信度 */
  newConfidence: Tryte;
  /** 对矛盾统一/转化的贡献 */
  contradictionProgress: Trit;
}

export interface ProtractedWarImpact {
  /** +1=加速阶段转换 0=无影响 -1=延缓 */
  phaseShift: Trit;
  newPhase?: 'defense' | 'stalemate' | 'counteroffensive';
}

/** 螺旋位置快照 */
export interface SpiralPosition {
  currentPhase: SpiralPhase;
  cycleCount: number;
  totalAscensions: number;
  currentDomain: string;
}

/** 螺旋历史记录 */
export interface SpiralHistoryEntry {
  cycleId: string;
  cycleNumber: number;
  domain: string;
  startedAt: Date;
  completedAt: Date;
  ascension: Trit;
}

export interface SpiralHistory {
  entries: SpiralHistoryEntry[];
  totalCycles: number;
  domains: string[];
}

/** 各阶段数据联合（用于 judgePhase） */
export type SpiralPhaseData =
  | PracticeResult
  | CognitionOutput
  | RePracticeResult
  | DeepenedCognition;
