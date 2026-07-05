/**
 * EmergenceDetector — 涌现检测器（Phase 5 真实实现）
 *
 * 在 OCGS（开放复杂巨系统论）框架下检测系统涌现行为：
 *   1. 交互密度分析 — 交互数/子系统数，高密度是涌现的必要条件
 *   2. 非线性检测 — 反馈回路、枢纽结构、负载集中
 *   3. 涌现行为识别 — 不可归因属性、非线性级联、密度触发
 *   4. 自组织模式 — 自引用、涌现簇、边界渗透
 *
 * @version 0.2.0-phase5
 */

import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import type {
  SystemModelSnapshot,
  EmergenceReport,
  EmergentBehavior,
  Nonlinearity,
  SubsystemDescriptor,
  Interaction,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 涌现检测器接口
// ═══════════════════════════════════════════════════════════════

export interface IEmergenceDetector {
  /** 检测涌现行为 */
  detectEmergence(snapshot: SystemModelSnapshot): EmergenceReport;

  /** 获取检测器版本 */
  getDetectorVersion(): string;

  /** 获取历史涌现报告数量 */
  getReportCount(): number;
}

// ═══════════════════════════════════════════════════════════════
// 算法阈值常量
// ═══════════════════════════════════════════════════════════════

/** 交互密度阈值 — 高于此值可能涌现 */
const DENSITY_HIGH = 3.0;

/** 交互密度阈值 — 中等密度，需关注 */
const DENSITY_MODERATE = 1.5;

/** 枢纽结构阈值 — N+ 个子系统指向同一目标 */
const HUB_THRESHOLD = 3;

/** 负载临界值 — 高于此值认为过载 */
const LOAD_CRITICAL = 0.8;

/** 高频交互阈值 — 频率高于此值认为异常 */
const FREQUENCY_HIGH = 2.0;

/** 综合判定分数阈值 */
const SCORE_CONFIDENT = 3;   // >= 3 → T_TRUE（确认涌现）
const SCORE_SUSPECTED = 1;   // >= 1 → T_UNKNOWN（疑似涌现）

// ═══════════════════════════════════════════════════════════════
// 内部辅助类型
// ═══════════════════════════════════════════════════════════════

interface DetectionContext {
  subsystems: SubsystemDescriptor[];
  interactions: Interaction[];
  emergentProperties: string[];
  interactionDensity: number;
}

// ═══════════════════════════════════════════════════════════════
// Phase 5 实现
// ═══════════════════════════════════════════════════════════════

export function createEmergenceDetector(): IEmergenceDetector {
  const detectorVersion = '0.2.0-phase5';
  const reports: EmergenceReport[] = [];

  function detectEmergence(snapshot: SystemModelSnapshot): EmergenceReport {
    const ctx = buildContext(snapshot);

    // 空系统 → 无条件 F_FALSE
    if (ctx.subsystems.length === 0) {
      const report = createEmptyReport(detectorVersion);
      reports.push(report);
      return report;
    }

    // 并行执行三项检测
    const nonlinearities = detectNonlinearities(ctx);
    const emergentBehaviors = detectEmergentBehaviors(ctx, nonlinearities);
    const selfOrganizationPatterns = detectSelfOrganizationPatterns(ctx);

    // 综合判定
    const detected = synthesizeDecision(
      emergentBehaviors,
      nonlinearities,
      selfOrganizationPatterns,
    );

    const report: EmergenceReport = {
      detected,
      emergentBehaviors,
      nonlinearities,
      selfOrganizationPatterns,
      timestamp: Date.now(),
      detectorVersion,
    };

    reports.push(report);
    return report;
  }

  function getDetectorVersion(): string {
    return detectorVersion;
  }

  function getReportCount(): number {
    return reports.length;
  }

  return {
    detectEmergence,
    getDetectorVersion,
    getReportCount,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. 构建检测上下文
// ═══════════════════════════════════════════════════════════════

function buildContext(snapshot: SystemModelSnapshot): DetectionContext {
  const { subsystems, interactions, emergentProperties } = snapshot;
  const interactionDensity =
    subsystems.length > 0
      ? interactions.length / subsystems.length
      : 0;

  return {
    subsystems,
    interactions,
    emergentProperties,
    interactionDensity,
  };
}

function createEmptyReport(version: string): EmergenceReport {
  return {
    detected: T_FALSE,
    emergentBehaviors: [],
    nonlinearities: [],
    selfOrganizationPatterns: [],
    timestamp: Date.now(),
    detectorVersion: version,
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. 非线性检测
// ═══════════════════════════════════════════════════════════════

function detectNonlinearities(ctx: DetectionContext): Nonlinearity[] {
  const { subsystems, interactions } = ctx;
  const results: Nonlinearity[] = [];

  // 2a. 反馈回路检测 — A→B 且 B→A
  const bidirectionals = findFeedbackLoops(interactions);
  for (const [a, b] of bidirectionals) {
    results.push({
      description: `反馈回路: ${a} ↔ ${b}`,
      trigger: `子系统 ${a} 和 ${b} 之间存在双向交互`,
      impact: '形成循环依赖，系统行为不可线性预测',
      severity: T_UNKNOWN,
    });
  }

  // 2b. 枢纽结构 — 3+ 子系统指向同一目标
  const hubs = findHubStructures(interactions);
  for (const [target, sources] of hubs) {
    results.push({
      description: `枢纽结构: ${sources.length} 个子系统集中连接到 ${target}`,
      trigger: `${sources.slice(0, 3).join('、')}${sources.length > 3 ? '等' : ''} → ${target}`,
      impact: '单点依赖集中，可能引发非线性级联效应',
      severity: T_UNKNOWN,
    });
  }

  // 2c. 负载集中 — 高负载 + 高依赖度
  for (const sub of subsystems) {
    const dependentCount = subsystems.filter(
      (s) => s.dependencies.includes(sub.name),
    ).length;
    if (sub.load >= LOAD_CRITICAL && dependentCount >= HUB_THRESHOLD) {
      results.push({
        description: `负载集中: ${sub.name} 负载 ${sub.load.toFixed(2)}，被 ${dependentCount} 个子系统依赖`,
        trigger: `${sub.name} 高负载 (≥${LOAD_CRITICAL}) 且高依赖度 (≥${HUB_THRESHOLD})`,
        impact: '关键节点过载可能导致系统行为突变',
        severity: T_UNKNOWN,
      });
    }
  }

  // 2d. 高频低质 — 高频但低质量的交互（潜在的蝴蝶效应）
  for (const ix of interactions) {
    if (ix.frequency >= FREQUENCY_HIGH && ix.quality === T_FALSE) {
      results.push({
        description: `低质高频交互: ${ix.from} → ${ix.to}，频率 ${ix.frequency.toFixed(1)}，质量低下`,
        trigger: `交互 ${ix.from}→${ix.to} 频率 ${ix.frequency.toFixed(1)} 但质量为低`,
        impact: '高频低质交互可能累积微小误差引发蝴蝶效应',
        severity: T_UNKNOWN,
      });
    }
  }

  return results;
}

/**
 * 查找反馈回路（双向交互对）。
 * 返回去重后的 [a, b] 对，保证 a < b（字典序）。
 */
function findFeedbackLoops(
  interactions: Interaction[],
): Array<[string, string]> {
  const outgoing = new Map<string, Set<string>>();
  for (const ix of interactions) {
    if (!outgoing.has(ix.from)) outgoing.set(ix.from, new Set());
    outgoing.get(ix.from)!.add(ix.to);
  }

  const loops: Array<[string, string]> = [];
  const seen = new Set<string>();

  for (const [from, targets] of outgoing) {
    for (const to of targets) {
      // 检查反向边是否存在
      if (outgoing.has(to) && outgoing.get(to)!.has(from)) {
        const key = [from, to].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          loops.push([from, to].sort() as [string, string]);
        }
      }
    }
  }

  return loops;
}

/**
 * 查找枢纽结构：返回 Map<target, sources[]>
 */
function findHubStructures(
  interactions: Interaction[],
): Map<string, string[]> {
  const targetCounts = new Map<string, string[]>();
  for (const ix of interactions) {
    if (!targetCounts.has(ix.to)) targetCounts.set(ix.to, []);
    const sources = targetCounts.get(ix.to)!;
    if (!sources.includes(ix.from)) {
      sources.push(ix.from);
    }
  }

  const hubs = new Map<string, string[]>();
  for (const [target, sources] of targetCounts) {
    if (sources.length >= HUB_THRESHOLD) {
      hubs.set(target, sources);
    }
  }

  return hubs;
}

// ═══════════════════════════════════════════════════════════════
// 3. 涌现行为检测
// ═══════════════════════════════════════════════════════════════

function detectEmergentBehaviors(
  ctx: DetectionContext,
  nonlinearities: Nonlinearity[],
): EmergentBehavior[] {
  const behaviors: EmergentBehavior[] = [];

  // 3a. 密度触发的涌现
  if (ctx.interactionDensity >= DENSITY_HIGH) {
    behaviors.push({
      description: `高交互密度涌现: 密度 ${ctx.interactionDensity.toFixed(1)}，超过阈值 ${DENSITY_HIGH}`,
      type: 'neutral',
      intensity: Math.min(1.0, (ctx.interactionDensity / DENSITY_HIGH) * 0.7),
      contributingFactors: [
        `交互密度: ${ctx.interactionDensity.toFixed(1)}`,
        `子系统: ${ctx.subsystems.length}`,
        `交互: ${ctx.interactions.length}`,
      ],
    });
  } else if (ctx.interactionDensity >= DENSITY_MODERATE) {
    behaviors.push({
      description: `中等交互密度: 密度 ${ctx.interactionDensity.toFixed(1)}，可能涌现`,
      type: 'neutral',
      intensity: 0.3,
      contributingFactors: [
        `交互密度: ${ctx.interactionDensity.toFixed(1)}`,
      ],
    });
  }

  // 3b. 不可归因的涌现属性 — 属性无法映射到任一子系统
  for (const prop of ctx.emergentProperties) {
    const attributable = ctx.subsystems.some(
      (s) =>
        s.name === prop ||
        (s.metadata && Object.values(s.metadata).includes(prop)),
    );
    if (!attributable) {
      behaviors.push({
        description: `涌现属性: "${prop}" — 无法归因于任何单一子系统`,
        type: 'desirable',
        intensity: 0.5,
        contributingFactors: [prop],
      });
    } else {
      // 可归因属性 — 低强度标记
      behaviors.push({
        description: `可归因涌现属性: "${prop}" — 已关联到子系统`,
        type: 'neutral',
        intensity: 0.2,
        contributingFactors: [prop],
      });
    }
  }

  // 3c. 非线性级联 — 多个非线性效应同时存在
  if (nonlinearities.length >= 2) {
    behaviors.push({
      description: `非线性级联: 检测到 ${nonlinearities.length} 个非线性效应`,
      type: 'undesirable',
      intensity: Math.min(1.0, nonlinearities.length * 0.25),
      contributingFactors: nonlinearities.map((n) => n.trigger),
    });
  }

  return behaviors;
}

// ═══════════════════════════════════════════════════════════════
// 4. 自组织模式检测
// ═══════════════════════════════════════════════════════════════

function detectSelfOrganizationPatterns(
  ctx: DetectionContext,
): string[] {
  const patterns: string[] = [];

  // 4a. 自引用依赖 — 子系统依赖自身
  for (const sub of ctx.subsystems) {
    if (sub.dependencies.includes(sub.name)) {
      patterns.push(
        `自引用依赖: 子系统 "${sub.name}" 依赖自身，呈递归自组织特征`,
      );
    }
  }

  // 4b. 涌现依赖簇 — 互依赖检测（任意两个子系统互相依赖）
  const clusters = findMutualDependencyClusters(ctx.subsystems);
  for (const cluster of clusters) {
    patterns.push(
      `涌现依赖簇: ${cluster.join('、')} 形成互依赖群，可能自组织`,
    );
  }

  // 4c. 高频边界渗透 — 高频交互跨越模糊/软边界
  const boundaryTypes = new Set([
    ...ctx.interactions.map((ix) => ix.type),
  ]);
  // 检测所有交互类型中是否有大量跨类型高频交互（表示子系统在跨越设计的边界通信）
  const typeCounts = new Map<string, number>();
  for (const ix of ctx.interactions) {
    if (ix.frequency >= FREQUENCY_HIGH) {
      typeCounts.set(ix.type, (typeCounts.get(ix.type) || 0) + 1);
    }
  }
  for (const [type, count] of typeCounts) {
    if (count >= 2) {
      patterns.push(
        `高频跨边界: ${count} 条高频交互使用类型 "${type}"，可能超越设计边界`,
      );
    }
  }

  return patterns;
}

/**
 * 查找互依赖簇 — 任意两个子系统互相声明对方为依赖
 */
function findMutualDependencyClusters(
  subsystems: SubsystemDescriptor[],
): string[][] {
  const clusters: string[][] = [];
  const visited = new Set<number>();

  for (let i = 0; i < subsystems.length; i++) {
    if (visited.has(i)) continue;
    const cluster: string[] = [subsystems[i].name];
    visited.add(i);

    for (let j = i + 1; j < subsystems.length; j++) {
      if (visited.has(j)) continue;
      const a = subsystems[i];
      const b = subsystems[j];
      const aDependsOnB = a.dependencies.includes(b.name);
      const bDependsOnA = b.dependencies.includes(a.name);

      if (aDependsOnB && bDependsOnA) {
        cluster.push(b.name);
        visited.add(j);
      }
    }

    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

// ═══════════════════════════════════════════════════════════════
// 5. 综合判定
// ═══════════════════════════════════════════════════════════════

function synthesizeDecision(
  behaviors: EmergentBehavior[],
  nonlinearities: Nonlinearity[],
  patterns: string[],
): Trit {
  let score = 0;

  // 强指标（各+2分）
  if (behaviors.some((b) => b.intensity >= 0.5 && b.type !== 'neutral')) {
    score += 2;
  }
  if (nonlinearities.length >= 2) {
    score += 2;
  }

  // 中指标（各+1分）
  if (behaviors.some((b) => b.intensity >= 0.3 && b.intensity < 0.5)) {
    score += 1;
  }
  if (nonlinearities.length === 1) {
    score += 1;
  }

  // 弱指标（各+0.5分）
  if (patterns.length >= 2) {
    score += 1;
  } else if (patterns.length === 1) {
    score += 0.5;
  }
  if (behaviors.some((b) => b.intensity > 0 && b.intensity < 0.3)) {
    score += 0.5;
  }

  // 判定
  if (score >= SCORE_CONFIDENT) return T_TRUE;   // 确认涌现
  if (score >= SCORE_SUSPECTED) return T_UNKNOWN; // 疑似涌现
  return T_FALSE;                                 // 无涌现迹象
}
