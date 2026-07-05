/**
 * KunlunContradiction — L5 矛盾分析引擎核心类型系统
 *
 * 对应架构文档第 5 章：矛盾分析引擎 — 四论之矛盾论
 *
 * 核心概念：
 *   输入 = 矛盾对（对立命题 A, B）
 *   输出 = 统一(+1) / 转化(0) / 不可调和(-1)
 *
 * 八个分析器对应唯物辩证法的基本范畴：
 *   1. 主要矛盾定位器
 *   2. 矛盾方面分析器
 *   3. 对立统一推导器
 *   4. 量变质变检测器
 *   5. 否定之否定检测器
 *   6. 矛盾转化预测器
 *   7. 统一条件推导器
 *   8. 矛盾链分析器
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import type { PresenceState } from '@kunlun/presence';

// ═══════════════════════════════════════════════════════════════
// 命题与证据
// ═══════════════════════════════════════════════════════════════

/** 命题来源 */
export type PropositionSource =
  | { type: 'knowledge'; fragmentId: string; bridgeId?: string }
  | { type: 'memory'; memoryId: string }
  | { type: 'perception'; signalId: string }
  | { type: 'human'; userId: string; inputText?: string }
  | { type: 'synthesis'; parentContradictionId: string }
  | { type: 'external'; url: string; fetchedAt: number };

/** 证据类型 */
export type EvidenceType =
  | 'empirical'      // 实证：可观测/可测量
  | 'logical'        // 逻辑：演绎/归纳推导
  | 'authoritative'  // 权威：专家/机构认定
  | 'experiential'   // 经验：实践/历史经验
  | 'synthetic'      // 综合：多源证据合成
  | 'heuristic';     // 启发性：类比/直觉

/** 单条证据 */
export interface Evidence {
  /** 证据类型 */
  type: EvidenceType;
  /** 证据内容 */
  content: string;
  /** 证据强度：+1=强证据, 0=弱证据, -1=反面证据 */
  strength: Trit;
  /** 来源引用 */
  source: string;
  /** 时间戳 */
  timestamp: number;
}

/** 命题——矛盾分析的基本单元 */
export interface Proposition {
  /** 命题唯一标识 */
  id: string;
  /** 命题陈述（自然语言） */
  statement: string;
  /** 所属领域（F01-F11 对应十一桥） */
  domain: string;
  /** 支持证据集 */
  evidence: Evidence[];
  /** 反对证据集 */
  counterEvidence: Evidence[];
  /** 命题信度：+1=确信, 0=存疑, -1=伪 */
  confidenceTrit: Trit;
  /** 六维信度向量 */
  confidenceVector: Tryte;
  /** 命题来源 */
  source: PropositionSource;
  /** 依赖的其他命题 ID */
  dependencies: string[];
  /** 创建时间 */
  createdAt: number;
  /** 最后修改时间 */
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// 矛盾对
// ═══════════════════════════════════════════════════════════════

/** 矛盾类型——对应唯物辩证法的矛盾分类 */
export type ContradictionType =
  | 'antagonistic'        // 对抗性矛盾：不可调和，一方消灭另一方
  | 'non_antagonistic'    // 非对抗性矛盾：可调和，通过协商解决
  | 'principal'           // 主要矛盾：在众多矛盾中起主导作用
  | 'secondary'           // 次要矛盾：从属于主要矛盾
  | 'internal'            // 内部矛盾：事物内部的矛盾
  | 'external'            // 外部矛盾：事物之间的矛盾
  | 'quantitative'        // 量变→质变边界的矛盾
  | 'negation';           // 否定之否定的矛盾

/** 矛盾的发现来源 */
export type ContradictionDiscoverySource =
  | 'diting_perception'   // 谛听感知
  | 'human_input'         // 人类输入
  | 'self_reflection'     // 自我反思
  | 'ecosystem_change'    // 生态变化
  | 'practice_feedback'   // 实践反馈
  | 'phase_shift';        // 阶段转换触发

/** 矛盾对——矛盾分析引擎的最小输入单元 */
export interface ContradictionPair {
  /** 矛盾对唯一标识 */
  id: string;
  /** 正题 */
  thesis: Proposition;
  /** 反题 */
  antithesis: Proposition;
  /** 矛盾类型 */
  contradictionType: ContradictionType;
  /** 发现源 */
  discoveredBy: ContradictionDiscoverySource;
  /** 发现时间 */
  discoveredAt: number;
  /** 关联的矛盾对 ID */
  relatedContradictions: string[];
  /** 矛盾优先级权重 0~1（越高越紧急） */
  priority: number;
  /** 当前在场状态（发现该矛盾时的在场状态） */
  presenceStateAtDiscovery: PresenceState;
  /** 所属持久战阶段 */
  warPhaseAtDiscovery: string;
}

// ═══════════════════════════════════════════════════════════════
// 矛盾状态与历史
// ═══════════════════════════════════════════════════════════════

/** 矛盾在某一时刻的状态快照 */
export interface ContradictionState {
  /** 时间戳 */
  timestamp: number;
  /** 正题强度 0~1 */
  thesisStrength: number;
  /** 反题强度 0~1 */
  antithesisStrength: number;
  /** 主导方面：+1=thesis主导, 0=均势, -1=antithesis主导 */
  dominantAspect: Trit;
  /** 持久战阶段 */
  phase: string;
  /** 备注 */
  note?: string;
}

/** 干预记录 */
export interface Intervention {
  /** 时间戳 */
  timestamp: number;
  /** 干预行为描述 */
  action: string;
  /** 干预效果：+1=有效, 0=无变化, -1=反效果 */
  effect: Trit;
  /** 效果证据 */
  evidence?: string;
}

/** 矛盾历史——追踪一个矛盾对的完整演变 */
export interface ContradictionHistory {
  /** 关联的矛盾对 ID */
  contradictionId: string;
  /** 历史状态序列 */
  states: ContradictionState[];
  /** 干预记录 */
  interventions: Intervention[];
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
}

// ═══════════════════════════════════════════════════════════════
// 八分析器输出类型
// ═══════════════════════════════════════════════════════════════

// ─── 1. 主要矛盾定位器 ───
export interface PrincipalContradictionResult {
  /** 主要矛盾 ID */
  principalId: string;
  /** 主要矛盾的主要方面：+1=thesis, -1=antithesis, 0=均衡 */
  principalAspect: Trit;
  /** 次要矛盾列表（按重要性排序） */
  secondaryContradictions: Array<{
    id: string;
    /** 与主要矛盾的从属强度 0~1 */
    subordinationStrength: number;
    /** 是否被主要矛盾支配 */
    dominatedByPrincipal: boolean;
  }>;
  /** 定位置信度 0~1 */
  confidence: number;
  /** 定位依据 */
  reasoning: string;
}

// ─── 2. 矛盾方面分析器 ───
export interface AspectAnalysis {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 正题分析 */
  thesis: {
    /** 力量评分 0~1 */
    strength: number;
    /** 证据支撑度 */
    evidenceSupport: number;
    /** 逻辑自洽性 0~1 */
    internalConsistency: number;
    /** 发展势头：+1=增强, 0=稳定, -1=减弱 */
    momentum: Trit;
    /** 关键支撑点 */
    keyPillars: string[];
  };
  /** 反题分析 */
  antithesis: {
    strength: number;
    evidenceSupport: number;
    internalConsistency: number;
    momentum: Trit;
    keyPillars: string[];
  };
  /** 综合判定：+1=thesis占优, 0=均势, -1=antithesis占优 */
  overallBalance: Trit;
  /** 力量对比趋势预测 */
  trendPrediction: string;
}

// ─── 3. 对立统一推导器 ───
export interface UnityDerivation {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 可统一性：+1=可统一, 0=条件性可统一, -1=不可调和 */
  unifiability: Trit;
  /** 统一的可能路径 */
  paths: UnificationPath[];
  /** 最佳路径索引 */
  bestPathIndex: number;
  /** 对立面共同基础（如果存在） */
  commonGround: string[];
  /** 推导置信度 */
  confidence: number;
}

export interface UnificationPath {
  /** 路径描述 */
  description: string;
  /** 统一类型 */
  type: 'synthesis' | 'transcendence' | 'absorption' | 'transformation';
  /** 可行性：+1=可行, 0=待验证, -1=不可行 */
  feasibility: Trit;
  /** 前提条件 */
  preconditions: string[];
  /** 预估代价 0~1 */
  estimatedEffort: number;
  /** 预期结果 */
  expectedOutcome: string;
  /** 潜在风险 */
  risks: string[];
}

// ─── 4. 量变质变检测器 ───
export interface QualitativeChangeAssessment {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 质变状态：+1=已质变（新质产生）, 0=接近临界点, -1=远离临界点 */
  approachingThreshold: Trit;
  /** 累计量变程度 0~1 */
  quantitativeAccumulation: number;
  /** 临界阈值 */
  thresholdValue: number;
  /** 预估质变时间（Unix timestamp，null 表示无法预估） */
  estimatedThresholdAt: number | null;
  /** 可能的触发因素 */
  triggers: QualitativeTrigger[];
  /** 质变后的预期新质 */
  expectedNewQuality: string;
}

export interface QualitativeTrigger {
  /** 触发因素描述 */
  description: string;
  /** 触发概率 0~1 */
  probability: number;
  /** 触发后影响：+1=加速质变, 0=未知影响, -1=延缓质变 */
  impact: Trit;
  /** 是否可控 */
  controllable: boolean;
}

// ─── 5. 否定之否定检测器 ───
export interface NegationAssessment {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 当前否定阶段：+1=否定之否定（螺旋上升）, 0=第一次否定阶段, -1=原状态 */
  stage: Trit;
  /** 螺旋上升标志 */
  isSpiralAscension: boolean;
  /** 在否定之否定中涌现的新属性 */
  emergentProperties: string[];
  /** 被保留的旧属性 */
  preservedProperties: string[];
  /** 被抛弃的旧属性 */
  discardedProperties: string[];
  /** 螺旋上升力度 0~1 */
  ascensionStrength: number;
  /** 循环次数 */
  cycleCount: number;
}

// ─── 6. 矛盾转化预测器 ───
export interface TransformationPaths {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 可能的转化路径（按概率排序） */
  paths: TransformationPath[];
  /** 转化必然性：+1=必然转化, 0=可能转化, -1=维持现状 */
  inevitability: Trit;
  /** 最可能路径索引 */
  mostLikelyPathIndex: number;
}

export interface TransformationPath {
  /** 路径描述 */
  description: string;
  /** 转化后形成的新的矛盾对（或 null 表示矛盾消解） */
  resultingContradiction: ContradictionPair | null;
  /** 转化概率 0~1 */
  probability: number;
  /** 转化条件 */
  conditions: string[];
  /** 转化为对抗性矛盾的概率 0~1 */
  antagonisticRisk: number;
}

// ─── 7. 统一条件推导器 ───
export interface UnificationConditions {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 统一的可能性：+1=可统一, 0=条件性统一, -1=不可统一 */
  unifiable: Trit;
  /** 必要条件列表 */
  necessaryConditions: UnificationCondition[];
  /** 充分条件列表 */
  sufficientConditions: UnificationCondition[];
  /** 最优条件组合 */
  optimalConditionSet: string[];
  /** 最小统一代价 */
  minimumCost: number;
}

export interface UnificationCondition {
  /** 条件描述 */
  description: string;
  /** 条件类型 */
  type: 'internal' | 'external' | 'temporal' | 'structural' | 'information';
  /** 条件满足度 0~1 */
  satisfactionLevel: number;
  /** 条件是否可控 */
  controllable: boolean;
  /** 实现条件所需的预估时间（ms） */
  estimatedTimeToFulfill: number | null;
}

// ─── 8. 矛盾链分析器 ───
export interface ContradictionChainGraph {
  /** 节点（矛盾对） */
  nodes: ContradictionChainNode[];
  /** 边（矛盾间的关系） */
  edges: ContradictionChainEdge[];
  /** 根矛盾（链的起点） */
  rootContradictionId: string | null;
  /** 是否存在循环依赖 */
  hasCycles: boolean;
  /** 链的长度 */
  chainLength: number;
  /** 整体可解性：+1=可解, 0=部分可解, -1=缠结 */
  solvability: Trit;
}

export interface ContradictionChainNode {
  /** 矛盾对 ID */
  contradictionId: string;
  /** 在链中的层级 0=根 */
  depth: number;
  /** 是主要矛盾 */
  isPrincipal: boolean;
  /** 入度 */
  inDegree: number;
  /** 出度 */
  outDegree: number;
}

export type ContradictionChainRelation =
  | 'causes'           // A 引起 B
  | 'intensifies'      // A 加剧 B
  | 'suppresses'       // A 抑制 B
  | 'transforms_into'  // A 转化为 B
  | 'contains'         // A 包含 B
  | 'resolves';        // A 的解决导致 B 消解

export interface ContradictionChainEdge {
  /** 源矛盾 ID */
  from: string;
  /** 目标矛盾 ID */
  to: string;
  /** 关系类型 */
  relation: ContradictionChainRelation;
  /** 关系强度 0~1 */
  strength: number;
  /** 关系是正向(+)还是负向(-) */
  direction: Trit;
}

// ═══════════════════════════════════════════════════════════════
// 矛盾引擎综合输出
// ═══════════════════════════════════════════════════════════════

/** 矛盾分析最终输出（三元结构） */
export interface ContradictionAnalysisOutput {
  /** 关联的矛盾对 ID */
  contradictionId: string;

  /** ─── 核心三元素 ─── */
  analysis: {
    /** 矛盾的可统一性：+1=可统一, 0=需更多信息, -1=不可调和 */
    unifiability: Trit;
    /** 统一的可能路径 */
    unificationPaths: UnificationPath[];
    /** 主要矛盾的方面：+1=thesis主导, 0=均势, -1=antithesis主导 */
    dominantAspect: Trit;
    /** 矛盾类型 */
    contradictionType: ContradictionType;
  };

  /** ─── 质变临界点评估 ─── */
  qualitativeChange: {
    /** 是否接近质变：+1=已质变, 0=接近临界, -1=离临界尚远 */
    approachingThreshold: Trit;
    /** 预估质变时间（Unix timestamp） */
    estimatedThresholdAt: number | null;
    /** 可能的触发因素 */
    triggers: QualitativeTrigger[];
    /** 累计量变程度 */
    quantitativeAccumulation: number;
  };

  /** ─── 否定之否定 ─── */
  negationCycle: {
    /** 否定阶段：+1=否定之否定（螺旋上升）, 0=第一次否定, -1=原状态 */
    stage: Trit;
    /** 螺旋上升中涌现的新属性 */
    emergentProperties: string[];
    /** 是否为真正的螺旋上升 */
    isGenuineAscension: boolean;
  };

  /** ─── 矛盾转化预测 ─── */
  transformationPrediction: {
    /** 转化必然性 */
    inevitability: Trit;
    /** 最可能的转化路径描述 */
    mostLikelyPath: string;
    /** 转化为对抗性矛盾的风险 0~1 */
    antagonisticRisk: number;
  };

  /** ─── 行动建议 ─── */
  recommendations: Array<{
    /** 行动描述 */
    action: string;
    /** 优先级：+1=紧急, 0=正常, -1=可选 */
    priority: Trit;
    /** 预期结果 */
    expectedOutcome: string;
    /** 置信度 0~1 */
    confidence: number;
    /** 前提条件 */
    preconditions: string[];
  }>;

  /** ─── 信度 ─── */
  overallConfidence: Trit;
  /** 六维信度向量 */
  confidenceVector: Tryte;

  /** ─── 元数据 ─── */
  metadata: {
    /** 分析时间戳 */
    analyzedAt: number;
    /** 分析耗时（ms） */
    analysisDurationMs: number;
    /** 参与分析的模块列表 */
    modulesExecuted: string[];
    /** 分析引擎版本 */
    engineVersion: string;
  };
}

// ═══════════════════════════════════════════════════════════════
// 矛盾引擎配置
// ═══════════════════════════════════════════════════════════════

/** 矛盾引擎运行时配置 */
export interface ContradictionEngineConfig {
  /** 是否启用所有 8 个分析器 */
  enableAllAnalyzers: boolean;
  /** 启用的分析器列表（当 enableAllAnalyzers 为 false 时有效） */
  enabledAnalyzers: string[];
  /** 分析深度：1=快速, 2=标准, 3=深度 */
  analysisDepth: 1 | 2 | 3;
  /** 矛盾自动发现：是否接受谛听自动发现的矛盾对 */
  autoDiscoveryEnabled: boolean;
  /** 矛盾对优先级阈值（低于此值的矛盾对不进行分析） */
  minimumPriority: number;
  /** 矛盾历史最大保留数量 */
  maxHistoryStates: number;
  /** 质变检测灵敏度 0~1（越高越敏感） */
  qualitativeChangeSensitivity: number;
  /** 矛盾链最大遍历深度 */
  maxChainDepth: number;
  /** 是否启用矛盾链循环检测 */
  chainCycleDetection: boolean;
}

/** 默认配置 */
export const DEFAULT_CONTRADICTION_ENGINE_CONFIG: ContradictionEngineConfig = {
  enableAllAnalyzers: true,
  enabledAnalyzers: [],
  analysisDepth: 2,
  autoDiscoveryEnabled: true,
  minimumPriority: 0.1,
  maxHistoryStates: 100,
  qualitativeChangeSensitivity: 0.5,
  maxChainDepth: 10,
  chainCycleDetection: true,
};

// ═══════════════════════════════════════════════════════════════
// 三元判定 Prompt 工程类型
// ═══════════════════════════════════════════════════════════════

/** Prompt 模板变量 */
export interface PromptTemplateVariables {
  /** 正题陈述 */
  thesisStatement: string;
  /** 反题陈述 */
  antithesisStatement: string;
  /** 矛盾类型 */
  contradictionType: ContradictionType;
  /** 领域上下文（十一桥） */
  domain: string;
  /** 分析深度要求 */
  depth: 'quick' | 'standard' | 'deep';
  /** 额外上下文 */
  additionalContext?: string;
  /** 历史分析结果（如果有） */
  previousAnalysis?: string;
}

/** 三元判定结果——LLM 响应解析后的结构化输出 */
export interface TernaryJudgmentResult {
  /** 综合判定：+1/0/-1 */
  verdict: Trit;
  /** 判定理由 */
  reasoning: string;
  /** 置信度 0~1 */
  confidence: number;
  /** 主要矛盾的方面判定 */
  dominantAspect: Trit;
  /** 统一路径建议 */
  unificationSuggestions: string[];
  /** 质变风险评估 */
  qualitativeChangeRisk: 'high' | 'medium' | 'low' | 'none';
  /** 行动建议 */
  recommendations: string[];
  /** 需要进一步信息的领域 */
  informationGaps: string[];
  /** 原始 LLM 响应（用于调试和审计） */
  rawResponse?: string;
}

/** Prompt 模板定义 */
export interface TernaryPromptTemplate {
  /** 模板名称 */
  name: string;
  /** 模板版本 */
  version: string;
  /** 模板用途描述 */
  description: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 用户提示词模板（使用 {{variable}} 占位符） */
  userPromptTemplate: string;
  /** 期望的输出格式说明 */
  outputFormatHint: string;
  /** 适用的分析深度 */
  recommendedDepth: 'quick' | 'standard' | 'deep';
}
