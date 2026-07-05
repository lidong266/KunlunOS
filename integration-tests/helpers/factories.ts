/**
 * 集成测试工厂函数
 * 为跨包测试提供标准化的测试数据构造器
 * 类型严格匹配各包的实际接口定义
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type {
  ContradictionPair,
  PropositionSource,
  Evidence,
  Proposition,
  EvidenceType,
  ContradictionType,
  ContradictionDiscoverySource,
} from '@kunlun/contradiction';
import type { PresenceState } from '@kunlun/presence';
import type {
  PracticeContext,
} from '@kunlun/spiral';
import type {
  PWContext,
  SpiralMetrics,
  PowerSnapshot,
  PhaseHistoryEntry,
  PWCriticalEvent,
  ProtractedWarPhase,
} from '@kunlun/pw';

// ─── Trit/Tryte 工具 ───

export function makeTryte(values: [Trit, Trit, Trit, Trit, Trit, Trit]): Tryte {
  return [...values] as Tryte;
}

export function makeDefaultTryte(): Tryte {
  return [T_UNKNOWN, T_UNKNOWN, T_UNKNOWN, T_UNKNOWN, T_UNKNOWN, T_UNKNOWN];
}

// ─── Evidence 工厂 ───

export function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    type: (overrides.type ?? 'empirical') as EvidenceType,
    source: overrides.source ?? 'test-source',
    content: overrides.content ?? '测试证据',
    strength: overrides.strength ?? T_UNKNOWN,
    timestamp: overrides.timestamp ?? Date.now(),
  };
}

// ─── Proposition 工厂 ───

export function makeProposition(overrides: Partial<Proposition> = {}): Proposition {
  const defaultSource: PropositionSource = { type: 'human', userId: 'test', inputText: '测试输入' };
  return {
    id: overrides.id ?? `prop-${Date.now()}`,
    statement: overrides.statement ?? '测试命题',
    domain: overrides.domain ?? 'general',
    evidence: overrides.evidence ?? [],
    counterEvidence: overrides.counterEvidence ?? [],
    confidenceTrit: overrides.confidenceTrit ?? T_UNKNOWN,
    confidenceVector: overrides.confidenceVector ?? makeDefaultTryte(),
    source: overrides.source ?? defaultSource,
    dependencies: overrides.dependencies ?? [],
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

// ─── ContradictionPair 工厂 ───

export function makeContradictionPair(overrides: Partial<ContradictionPair> = {}): ContradictionPair {
  const secProp = makeProposition({
    statement: '系统应优先保证安全性',
    evidence: [
      makeEvidence({ content: '安全审计发现3个高危漏洞', strength: T_TRUE }),
      makeEvidence({ content: '安全团队报告指出系统存在风险', strength: T_TRUE }),
    ],
  });
  const perfProp = makeProposition({
    statement: '系统应优先保证性能',
    evidence: [
      makeEvidence({ content: '性能基准测试延迟<10ms', strength: T_TRUE }),
    ],
  });

  return {
    id: overrides.id ?? `cp-${Date.now()}`,
    thesis: overrides.thesis ?? secProp,
    antithesis: overrides.antithesis ?? perfProp,
    contradictionType: (overrides.contradictionType ?? 'principal') as ContradictionType,
    discoveredBy: (overrides.discoveredBy ?? 'human_input') as ContradictionDiscoverySource,
    discoveredAt: overrides.discoveredAt ?? Date.now(),
    relatedContradictions: overrides.relatedContradictions ?? [],
    priority: overrides.priority ?? 0.5,
    presenceStateAtDiscovery: (overrides.presenceStateAtDiscovery ?? 'AWAKE') as PresenceState,
    warPhaseAtDiscovery: overrides.warPhaseAtDiscovery ?? 'defense',
  };
}

// ─── Convenience factories ───

/**
 * 安全 vs 性能 矛盾对（常用测试 fixture）
 */
export function securityVsPerformance(): ContradictionPair {
  return makeContradictionPair({
    id: 'cp-sec-vs-perf',
    thesis: makeProposition({
      id: 'prop-sec',
      statement: '系统应优先保证安全性，严格限制外部访问',
      domain: 'F01',
      evidence: [makeEvidence({ content: '安全合规要求所有接口需认证', strength: T_TRUE })],
      confidenceTrit: T_TRUE,
    }),
    antithesis: makeProposition({
      id: 'prop-perf',
      statement: '系统应优先保证性能，减少不必要的安全检查开销',
      domain: 'F03',
      evidence: [makeEvidence({ content: '安全检查导致延迟增加200ms', strength: T_TRUE })],
      confidenceTrit: T_TRUE,
    }),
    contradictionType: 'antagonistic' as ContradictionType,
    priority: 0.9,
  });
}

// ─── PracticeContext 工厂 ───

export function makePracticeContext(overrides: Partial<PracticeContext> = {}): PracticeContext {
  return {
    domain: overrides.domain ?? 'general',
    hypothesis: overrides.hypothesis ?? makeProposition({ id: 'prop-hypothesis', statement: '测试假设：A优于B' }),
    environment: overrides.environment ?? {
      type: 'simulation',
      constraints: ['time', 'resource'],
    },
    relatedContradictions: overrides.relatedContradictions ?? [],
  };
}

// ─── PWContext 工厂 ───

export function makeSpiralMetrics(overrides: Partial<SpiralMetrics> = {}): SpiralMetrics {
  return {
    totalCycles: overrides.totalCycles ?? 5,
    recentAscensionRatio: overrides.recentAscensionRatio ?? {
      ascension: 0.4,
      flat: 0.3,
      regression: 0.3,
    },
    recentBreakthroughs: overrides.recentBreakthroughs ?? [],
  };
}

export function makePowerSnapshot(overrides: Partial<PowerSnapshot> = {}): PowerSnapshot {
  return {
    capabilities: overrides.capabilities ?? { processing: 0.5, reasoning: 0.5 },
    opponentCapabilities: overrides.opponentCapabilities ?? { complexity: 0.6 },
    relativeStrengthRatio: overrides.relativeStrengthRatio ?? 0.83,
    strengthTrend: overrides.strengthTrend ?? [0.8, 0.82, 0.83],
  };
}

export function makePWContext(overrides: Partial<PWContext> = {}): PWContext {
  return {
    totalRuntime: overrides.totalRuntime ?? 0,
    currentPhaseDuration: overrides.currentPhaseDuration ?? 0,
    phaseHistory: overrides.phaseHistory ?? [],
    powerSnapshot: overrides.powerSnapshot ?? makePowerSnapshot(),
    activeContradictions: overrides.activeContradictions ?? [],
    spiralMetrics: overrides.spiralMetrics ?? makeSpiralMetrics(),
    criticalEvents: overrides.criticalEvents ?? [],
  };
}

// ─── PhaseHistoryEntry 工厂 ───

export function makePhaseHistoryEntry(
  phase: ProtractedWarPhase = 'defense',
  overrides: Partial<PhaseHistoryEntry> = {},
): PhaseHistoryEntry {
  return {
    phase,
    enteredAt: overrides.enteredAt ?? new Date(),
    ...overrides,
  };
}
