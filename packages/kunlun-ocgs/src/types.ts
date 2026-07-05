/**
 * @kunlun/ocgs — L6 OCGS 自适应层类型定义
 *
 * 开放复杂巨系统论（钱学森）：
 *   生态感知 → 系统建模 → 涌现检测 → 自适应调节
 *
 * 九大生态源 + 四维复杂度 + 涌现三态
 *
 * @version 0.1.0-phase4
 */

import type { Trit } from '@kunlun/ternary';
import type { ContradictionPair } from '@kunlun/contradiction';

// ═══════════════════════════════════════════════════════════════
// 生态源
// ═══════════════════════════════════════════════════════════════

/**
 * 九大生态源
 * - `self`: Pi-昆仑自身（内部子系统变化）
 * - `openclaw`: OpenClaw 版本/能力变化
 * - `hermes`: Hermes 协议变更
 * - `clawhub`: ClawHub 生态新能力
 * - `mcp_topology`: MCP 服务拓扑变化
 * - `agent_ecosystem`: Agent 生态新成员
 * - `tool_ecosystem`: 工具生态变化
 * - `model_ecosystem`: 模型生态变化
 * - `user_behavior`: 用户行为模式变化
 */
export type EcosystemSource =
  | 'self'
  | 'openclaw'
  | 'hermes'
  | 'clawhub'
  | 'mcp_topology'
  | 'agent_ecosystem'
  | 'tool_ecosystem'
  | 'model_ecosystem'
  | 'user_behavior';

// ═══════════════════════════════════════════════════════════════
// 生态感知
// ═══════════════════════════════════════════════════════════════

/** 单个生态信号 */
export interface EcosystemSignal {
  source: EcosystemSource;
  signalType: string;
  /** 变化的显著性：+1=重大变化, 0=一般, -1=无变化 */
  significance: Trit;
  description: string;
  /** 对 Pi-昆仑的影响评估 */
  impact: {
    direction: Trit;    // +1=有利, 0=中性, -1=不利
    affectedSubsystems: string[];
    urgency: Trit;      // +1=需立即响应, 0=可计划, -1=可忽略
  };
  /** 信号时间戳 */
  detectedAt: number;
}

/** 生态源扫描状态 */
export type SourceStatus = 'ok' | 'degraded' | 'unavailable' | 'stub';

/** 单源扫描结果 */
export interface SourceScanDetail {
  source: EcosystemSource;
  status: SourceStatus;
  signals: EcosystemSignal[];
  error?: string;
  latencyMs: number;
}

/** 生态扫描结果 */
export interface EcosystemScanResult {
  scanId: string;
  timestamp: Date;
  /** 各生态源的信号 */
  signals: EcosystemSignal[];
  /** 各源扫描详情（含降级信息） */
  sourceDetails: SourceScanDetail[];
  /** 整体生态健康度：+1=繁荣, 0=稳定, -1=衰退 */
  ecosystemHealth: Trit;
  /** 扫描耗时统计 */
  stats: {
    totalLatencyMs: number;
    sourcesScanned: number;
    sourcesUnavailable: number;
    sourcesDegraded: number;
  };
}

/** 生态变化事件 */
export interface EcosystemChange {
  type:
    | 'capability_gain'
    | 'capability_loss'
    | 'dependency_change'
    | 'protocol_update'
    | 'new_competitor'
    | 'ecosystem_restructure';
  source: EcosystemSource;
  description: string;
  affectedComponents: string[];
  severity: Trit;        // +1=严重, 0=中等, -1=轻微
  timestamp: number;
}

/** 生态事件处理器 */
export type EcosystemEventHandler = (event: EcosystemChange) => void;

// ═══════════════════════════════════════════════════════════════
// 系统建模
// ═══════════════════════════════════════════════════════════════

/** 子系统描述 */
export interface SubsystemDescriptor {
  name: string;
  /** 状态：+1=正常, 0=降级, -1=故障 */
  status: Trit;
  dependencies: string[];
  dependents: string[];
  /** 当前负载 0~1 */
  load: number;
  /** 元数据 */
  metadata: Record<string, string>;
}

/** 子系统间交互 */
export interface Interaction {
  from: string;
  to: string;
  type: string;
  /** 交互频率（次/周期） */
  frequency: number;
  /** 交互质量：+1=高效, 0=正常, -1=低效 */
  quality: Trit;
}

/** 系统边界定义 */
export interface SystemBoundaries {
  /** 硬边界（不可跨越） */
  hard: string[];
  /** 软边界（可渗透） */
  soft: string[];
  /** 模糊边界（持续协商） */
  fuzzy: string[];
}

/** 系统模型快照 */
export interface SystemModelSnapshot {
  /** 当前子系统图 */
  subsystems: SubsystemDescriptor[];
  /** 子系统间交互 */
  interactions: Interaction[];
  /** 涌现属性 */
  emergentProperties: string[];
  /** 系统边界 */
  boundaries: SystemBoundaries;
  /** 快照版本号 */
  version: number;
  /** 快照时间 */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// 复杂度评估
// ═══════════════════════════════════════════════════════════════

/** 复杂度分类 */
export type ComplexityClass = 'simple' | 'complicated' | 'complex' | 'chaotic';

/** 推荐管理方式 */
export type ManagementApproach =
  | 'probe_sense_respond'
  | 'sense_analyze_respond'
  | 'act_sense_respond';

/** 复杂度评估结果 */
export interface ComplexityAssessment {
  /** 复杂性分类 */
  complexityClass: ComplexityClass;
  /** 子系统数量 */
  subsystemCount: number;
  /** 交互密度：交互数 / 子系统数 */
  interactionDensity: number;
  /** 非线性程度 0~1 */
  nonlinearityIndex: number;
  /** 可预测性：+1=可预测, 0=部分, -1=不可预测 */
  predictability: Trit;
  /** 推荐的管理方式 */
  recommendedApproach: ManagementApproach;
  /** 评估时间 */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// 涌现检测
// ═══════════════════════════════════════════════════════════════

/** 涌现行为描述 */
export interface EmergentBehavior {
  description: string;
  type: 'desirable' | 'undesirable' | 'neutral';
  /** 强度 0~1 */
  intensity: number;
  contributingFactors: string[];
}

/** 非线性效应 */
export interface Nonlinearity {
  description: string;
  trigger: string;
  impact: string;
  severity: Trit;
}

/** 涌现检测报告 */
export interface EmergenceReport {
  /** 是否检测到涌现：+1=确认, 0=疑似, -1=无 */
  detected: Trit;
  /** 涌现属性描述 */
  emergentBehaviors: EmergentBehavior[];
  /** 非线性效应 */
  nonlinearities: Nonlinearity[];
  /** 自组织模式 */
  selfOrganizationPatterns: string[];
  /** 报告时间 */
  timestamp: number;
  /** 检测引擎版本 */
  detectorVersion: string;
}

// ═══════════════════════════════════════════════════════════════
// 自适应调节
// ═══════════════════════════════════════════════════════════════

/** 自适应措施 */
export interface AdaptiveMeasure {
  action: string;
  targetComponent: string;
  effect: string;
  verified: Trit;  // +1=已验证, 0=待验证, -1=验证失败
}

/** 认知模式 */
export type CognitiveMode = 'explore' | 'exploit' | 'defend' | 'observe';

/** 自适应指令 */
export interface AdaptationDirective {
  /** 指令唯一标识 */
  id: string;
  /** 触发的生态变化 */
  triggeredBy: EcosystemChange;
  /** 推荐的认知模式切换 */
  cognitiveMode: CognitiveMode;
  /** 子系统重组建议 */
  subsystemRebalance: Array<{
    subsystem: string;
    action: 'activate' | 'deactivate' | 'scale_up' | 'scale_down';
    reason: string;
  }>;
  /** 边界调整 */
  boundaryAdjustments: Array<{
    boundary: string;
    boundaryType: 'hard' | 'soft' | 'fuzzy';
    action: 'tighten' | 'loosen' | 'redefine';
    reason: string;
  }>;
  /** 需要采取的措施 */
  measures: AdaptiveMeasure[];
  /** 优先级 0~1 */
  priority: number;
}

/** 自适应执行结果 */
export interface AdaptationResult {
  /** 适应是否成功：+1=成功, 0=部分, -1=失败 */
  success: Trit;
  /** 采取的措施 */
  measures: AdaptiveMeasure[];
  /** 系统模型更新描述 */
  modelDelta: string[];
  /** 触发的矛盾 */
  triggeredContradictions: ContradictionPair[];
  /** 应用的自适应指令 ID */
  directiveId: string;
  /** 执行时间 */
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════
// OCGS 全局状态
// ═══════════════════════════════════════════════════════════════

/** OCGS 全局状态快照 */
export interface OCGSState {
  /** 生态感知度：+1=敏锐, 0=正常, -1=迟钝 */
  ecosystemAwareness: Trit;
  /** 当前复杂度分类 */
  complexityClass: ComplexityClass;
  /** 最近一次自适应时间 */
  lastAdaptationAt: Date | null;
  /** 涌现检测次数 */
  emergenceCount: number;
  /** 系统模型版本号 */
  modelVersion: number;
  /** 当前认知模式 */
  cognitiveMode: CognitiveMode;
  /** 生态健康度 */
  ecosystemHealth: Trit;
  /** 自适应成功次数统计 */
  adaptationStats: {
    total: number;
    successful: number;
    partial: number;
    failed: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// 编排器配置
// ═══════════════════════════════════════════════════════════════

/** 编排器触发策略 */
export type OrchestrationTrigger = 'manual' | 'interval' | 'event_driven';

/** 编排器配置 */
export interface OCGSOrchestratorConfig {
  /** 触发策略 */
  trigger: OrchestrationTrigger;
  /** 扫描间隔（ms），仅 interval 模式有效 */
  scanIntervalMs: number;
  /** 自适应延迟（ms）：生态变化后等待一段时间再适应，避免频繁震荡 */
  adaptationDebounceMs: number;
  /** 最小自适应间隔（ms）：两次适应之间的最小间隔 */
  minAdaptationIntervalMs: number;
  /** 启用的生态源 */
  enabledSources: EcosystemSource[];
  /** 扫描超时（ms） */
  scanTimeoutMs: number;
  /** 是否启用涌现检测 */
  emergenceDetectionEnabled: boolean;
  /** 是否记录详细日志 */
  verbose: boolean;
}

/** 默认编排器配置 */
export const DEFAULT_OCGS_ORCHESTRATOR_CONFIG: OCGSOrchestratorConfig = {
  trigger: 'interval',
  scanIntervalMs: 60000,       // 1 分钟
  adaptationDebounceMs: 5000,  // 5 秒
  minAdaptationIntervalMs: 30000, // 30 秒
  enabledSources: ['self', 'openclaw', 'mcp_topology'],
  scanTimeoutMs: 10000,        // 10 秒
  emergenceDetectionEnabled: false,
  verbose: false,
};

// ═══════════════════════════════════════════════════════════════
// 生态源扫描器接口（内部工厂用）
// ═══════════════════════════════════════════════════════════════

/** 单源扫描器函数签名 */
export type SourceScanner = (timeoutMs: number) => Promise<SourceScanDetail>;
