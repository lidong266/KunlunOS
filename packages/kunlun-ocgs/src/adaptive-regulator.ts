/**
 * AdaptiveRegulator — 自适应调节器（规则引擎版）
 *
 * Phase 4 交付基于 If-This-Then-That 规则的自适应调节器。
 * 将生态变化事件映射为 AdaptationDirective，生成 ContradictionPair
 * 并返回 AdaptationResult。
 *
 * 规则覆盖 6 种 EcosystemChange 类型：
 *   capability_gain / capability_loss / dependency_change
 *   protocol_update / new_competitor / ecosystem_restructure
 */

import { T_TRUE, T_UNKNOWN, T_FALSE, TRYTE_ZERO } from '@kunlun/ternary';
import type { Trit, Tryte } from '@kunlun/ternary';
import type { ContradictionPair, ContradictionType, Evidence } from '@kunlun/contradiction';
import type {
  EcosystemChange,
  AdaptationDirective,
  AdaptationResult,
  AdaptiveMeasure,
  CognitiveMode,
  OCGSState,
  ComplexityClass,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 自适应调节器接口
// ═══════════════════════════════════════════════════════════════

export interface IAdaptiveRegulator {
  /** 处理生态变化并生成适应结果 */
  adapt(change: EcosystemChange): AdaptationResult;

  /** 获取当前认知模式 */
  getCognitiveMode(): CognitiveMode;

  /** 获取 OCGS 全局状态 */
  getOCGSState(): OCGSState;

  /** 获取历史适应结果数量 */
  getAdaptationCount(): number;
}

// ═══════════════════════════════════════════════════════════════
// 规则引擎
// ═══════════════════════════════════════════════════════════════

/**
 * 变化类型 → 认知模式 映射规则
 */
const COGNITIVE_MODE_RULES: Record<EcosystemChange['type'], CognitiveMode> = {
  capability_gain: 'explore',
  capability_loss: 'defend',
  dependency_change: 'observe',
  protocol_update: 'explore',
  new_competitor: 'defend',
  ecosystem_restructure: 'observe',
};

/**
 * 判断变化是否为严重级别
 */
function isSerious(change: EcosystemChange): boolean {
  return change.severity === T_TRUE;
}

/**
 * 变化类型 → 措施生成规则
 */
function generateMeasures(change: EcosystemChange): Omit<AdaptiveMeasure, 'verified'>[] {
  const base: Omit<AdaptiveMeasure, 'verified'>[] = [];

  switch (change.type) {
    case 'capability_gain':
      base.push({
        action: `Integrate new capability from ${change.source}`,
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Extend system boundary to absorb new capability',
      });
      base.push({
        action: 'Update subsystem dependency graph',
        targetComponent: 'ocgs',
        effect: 'Register new capability as available subsystem',
      });
      break;

    case 'capability_loss':
      base.push({
        action: `Degrade gracefully after ${change.source} capability loss`,
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Switch to fallback mode for affected subsystem',
      });
      base.push({
        action: 'Trigger subsystem health check',
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Verify remaining capabilities and adjust load',
      });
      break;

    case 'dependency_change':
      base.push({
        action: `Re-evaluate dependency on ${change.source}`,
        targetComponent: 'ocgs',
        effect: 'Update dependency version constraints',
      });
      base.push({
        action: 'Run compatibility assessment',
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Detect breaking changes in new dependency version',
      });
      break;

    case 'protocol_update':
      base.push({
        action: `Adapt to ${change.source} protocol update`,
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Update protocol handler to match new version',
      });
      base.push({
        action: 'Verify backward compatibility',
        targetComponent: change.affectedComponents[0] ?? 'ocgs',
        effect: 'Ensure old clients remain supported',
      });
      break;

    case 'new_competitor':
      base.push({
        action: `Assess competitive impact of ${change.source}`,
        targetComponent: 'contradiction',
        effect: 'Create competitive analysis contradiction pair',
      });
      base.push({
        action: 'Adjust subsystem allocation',
        targetComponent: 'ocgs',
        effect: 'Shift resources to defensive posture',
      });
      break;

    case 'ecosystem_restructure':
      base.push({
        action: `Respond to ecosystem restructure from ${change.source}`,
        targetComponent: 'ocgs',
        effect: 'Re-evaluate all boundary definitions',
      });
      base.push({
        action: 'Update system model topology',
        targetComponent: 'ocgs',
        effect: 'Rebuild subsystem interaction graph',
      });
      break;

    default:
      base.push({
        action: `Handle unknown change type from ${change.source}`,
        targetComponent: 'ocgs',
        effect: 'Defer to manual review',
      });
  }

  return base;
}

/**
 * 创建 Evidence 对象
 */
function makeEvidence(
  type: Evidence['type'],
  content: string,
  source: string,
  strength: Trit,
  timestamp: number,
): Evidence {
  return { type, content, source, strength, timestamp };
}

/**
 * 变化类型 → ContradictionPair 工厂
 * 将生态变化映射为矛盾对，使用 ecosystem_change 发现源
 */
function createContradictionFromChange(
  change: EcosystemChange,
  index: number,
): ContradictionPair {
  const now = Date.now();

  // 矛盾类型映射
  const contradictionTypeMap: Record<EcosystemChange['type'], ContradictionType> = {
    capability_gain: 'internal',
    capability_loss: 'internal',
    dependency_change: 'external',
    protocol_update: 'external',
    new_competitor: 'antagonistic',
    ecosystem_restructure: 'non_antagonistic',
  };

  return {
    id: `ocgs-${change.type}-${index}-${now}`,
    thesis: {
      id: `ocgs-thesis-${index}-${now}`,
      statement: `System must adapt to ${change.type}: ${change.description}`,
      domain: 'F11',
      evidence: [
        makeEvidence(
          'empirical',
          change.description,
          change.source,
          isSerious(change) ? T_UNKNOWN : T_TRUE,
          now,
        ),
      ],
      counterEvidence: [],
      confidenceTrit: T_UNKNOWN,
      confidenceVector: TRYTE_ZERO,
      source: {
        type: 'perception',
        signalId: `ocgs-${change.type}-${now}`,
      },
      dependencies: [],
      createdAt: now,
      updatedAt: now,
    },
    antithesis: {
      id: `ocgs-antithesis-${index}-${now}`,
      statement: `Current system configuration may not be optimal for ${change.type} from ${change.source}`,
      domain: 'F11',
      evidence: [
        makeEvidence(
          'heuristic',
          'Assumption that adaptation is needed',
          'ocgs',
          T_UNKNOWN,
          now,
        ),
      ],
      counterEvidence: [],
      confidenceTrit: T_UNKNOWN,
      confidenceVector: TRYTE_ZERO,
      source: {
        type: 'perception',
        signalId: `ocgs-antithesis-${now}`,
      },
      dependencies: [],
      createdAt: now,
      updatedAt: now,
    },
    contradictionType: contradictionTypeMap[change.type] ?? 'non_antagonistic',
    discoveredBy: 'ecosystem_change',
    discoveredAt: now,
    relatedContradictions: [],
    priority: change.severity === T_TRUE ? 0.8 : change.severity === T_UNKNOWN ? 0.5 : 0.3,
    presenceStateAtDiscovery: 'WATCHING',
    warPhaseAtDiscovery: 'stalemate',
  };
}

/** 严重度 → 子 contradiction 数量 */
function getContradictionCount(change: EcosystemChange): number {
  if (change.severity === T_TRUE) return 2;
  if (change.severity === T_UNKNOWN) return 1;
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// AdaptiveRegulator 实现
// ═══════════════════════════════════════════════════════════════

export function createAdaptiveRegulator(config?: {
  initialCognitiveMode?: CognitiveMode;
}): IAdaptiveRegulator {
  let cognitiveMode: CognitiveMode = config?.initialCognitiveMode ?? 'observe';
  const adaptationHistory: AdaptationResult[] = [];
  const adaptationStats = {
    total: 0,
    successful: 0,
    partial: 0,
    failed: 0,
  };

  function adapt(change: EcosystemChange): AdaptationResult {
    const now = Date.now();

    // 1. 生成认知模式
    const newMode = COGNITIVE_MODE_RULES[change.type] ?? 'observe';
    cognitiveMode = newMode;

    // 2. 生成措施
    const rawMeasures = generateMeasures(change);
    const measures: AdaptiveMeasure[] = rawMeasures.map((m) => ({
      ...m,
      verified: T_UNKNOWN, // 待验证
    }));

    // 3. 生成子系统重组建议
    const subsystemRebalance = change.affectedComponents.map((comp) => ({
      subsystem: comp,
      action: isSerious(change)
        ? ('scale_up' as const)
        : change.severity === T_FALSE
          ? ('scale_down' as const)
          : ('activate' as const),
      reason: `Triggered by ${change.type} from ${change.source}`,
    }));

    // 4. 生成边界调整
    const boundaryAdjustments = change.type === 'ecosystem_restructure'
      ? [
          {
            boundary: 'ecosystem_sensing',
            boundaryType: 'fuzzy' as const,
            action: 'redefine' as const,
            reason: 'Ecosystem restructure requires new sensing boundaries',
          },
        ]
      : [];

    // 5. 创建自适应指令
    const directive: AdaptationDirective = {
      id: `adapt-${change.type}-${now}`,
      triggeredBy: change,
      cognitiveMode,
      subsystemRebalance,
      boundaryAdjustments,
      measures,
      priority: change.severity === T_TRUE ? 0.9 : change.severity === T_UNKNOWN ? 0.5 : 0.2,
    };

    // 6. 生成 ContradictionPair
    const contradictionCount = getContradictionCount(change);
    const triggeredContradictions: ContradictionPair[] = [];
    for (let i = 0; i < contradictionCount; i++) {
      triggeredContradictions.push(createContradictionFromChange(change, i));
    }

    // 7. 判断适应是否成功
    let success: Trit;
    if (measures.length >= 2 && contradictionCount > 0) {
      success = T_TRUE;  // 有措施+矛盾识别 → 成功适应
    } else if (measures.length > 0) {
      success = T_UNKNOWN;  // 有措施但无矛盾 → 部分适应
    } else {
      success = T_FALSE;
    }

    // 8. 模型 delta
    const modelDelta: string[] = [
      `Cognitive mode: ${cognitiveMode}`,
      `Measures: ${measures.length} actions`,
      `Contradictions triggered: ${contradictionCount}`,
    ];

    const result: AdaptationResult = {
      success,
      measures,
      modelDelta,
      triggeredContradictions,
      directiveId: directive.id,
      timestamp: now,
    };

    // 更新统计
    adaptationStats.total++;
    if (success === T_TRUE) adaptationStats.successful++;
    else if (success === T_UNKNOWN) adaptationStats.partial++;
    else adaptationStats.failed++;

    adaptationHistory.push(result);
    return result;
  }

  function getCognitiveMode(): CognitiveMode {
    return cognitiveMode;
  }

  function getOCGSState(): OCGSState {
    const lastResult = adaptationHistory[adaptationHistory.length - 1];
    const lastAdaptationAt = lastResult ? new Date(lastResult.timestamp) : null;

    // 基于适应统计推断生态感知度
    let ecosystemAwareness: Trit;
    if (adaptationStats.total === 0) {
      ecosystemAwareness = T_UNKNOWN;
    } else if (adaptationStats.successful / adaptationStats.total >= 0.7) {
      ecosystemAwareness = T_TRUE;
    } else if (adaptationStats.successful / adaptationStats.total <= 0.3) {
      ecosystemAwareness = T_FALSE;
    } else {
      ecosystemAwareness = T_UNKNOWN;
    }

    // 基于适应性推断复杂度
    let complexityClass: ComplexityClass;
    if (adaptationStats.total <= 5) {
      complexityClass = 'simple';
    } else if (adaptationStats.total <= 15) {
      complexityClass = 'complicated';
    } else {
      complexityClass = 'complex';
    }

    // 生态健康度
    let ecosystemHealth: Trit;
    if (adaptationStats.failed > adaptationStats.successful) {
      ecosystemHealth = T_FALSE;
    } else if (adaptationStats.successful > 0) {
      ecosystemHealth = T_TRUE;
    } else {
      ecosystemHealth = T_UNKNOWN;
    }

    return {
      ecosystemAwareness,
      complexityClass,
      lastAdaptationAt,
      emergenceCount: 0,
      modelVersion: adaptationStats.total,
      cognitiveMode,
      ecosystemHealth,
      adaptationStats: { ...adaptationStats },
    };
  }

  function getAdaptationCount(): number {
    return adaptationStats.total;
  }

  return {
    adapt,
    getCognitiveMode,
    getOCGSState,
    getAdaptationCount,
  };
}
