/**
 * 集成测试标准 fixtures
 * 预构建的测试数据集，类型匹配实际包接口
 */

import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { ContradictionPair } from '@kunlun/contradiction';
import {
  makeContradictionPair,
  makePracticeContext,
  makePWContext,
  makeSpiralMetrics,
  makeProposition,
  makeEvidence,
} from './factories';

// ─── 标准矛盾对 ───

export const securityVsPerformance: ContradictionPair = makeContradictionPair({
  id: 'cp-security-perf',
  thesis: makeProposition({
    id: 'prop-cp-security',
    statement: '系统应严格限制访问以保证安全',
    domain: 'F01',
    evidence: [makeEvidence({ content: '安全审计显示高风险', strength: T_TRUE })],
    confidenceTrit: T_TRUE,
  }),
  antithesis: makeProposition({
    id: 'prop-cp-perf',
    statement: '系统应尽量减少验证步骤以提升性能',
    domain: 'F03',
    evidence: [makeEvidence({ content: '性能测试延迟超标', strength: T_TRUE })],
    confidenceTrit: T_TRUE,
  }),
  contradictionType: 'principal',
  priority: 0.9,
});

export const innovationVsStability: ContradictionPair = makeContradictionPair({
  id: 'cp-innovation-stability',
  thesis: makeProposition({
    id: 'prop-innovate',
    statement: '应快速迭代引入新特性以满足用户需求',
    domain: 'F05',
    confidenceTrit: T_TRUE,
  }),
  antithesis: makeProposition({
    id: 'prop-stable',
    statement: '应保持系统稳定避免引入风险',
    domain: 'F01',
    confidenceTrit: T_TRUE,
  }),
  contradictionType: 'principal',
  priority: 0.8,
});

export const centralizationVsDistribution: ContradictionPair = makeContradictionPair({
  id: 'cp-central-decentral',
  thesis: makeProposition({
    id: 'prop-central',
    statement: '集中式架构便于管理和一致性维护',
    domain: 'F03',
  }),
  antithesis: makeProposition({
    id: 'prop-decentral',
    statement: '分散式架构提供更好的弹性和扩展性',
    domain: 'F03',
  }),
  contradictionType: 'secondary',
  priority: 0.6,
});

export const resolvedContradiction: ContradictionPair = makeContradictionPair({
  id: 'cp-resolved',
  thesis: makeProposition({
    id: 'prop-short-term',
    statement: '短期目标A',
    confidenceTrit: T_FALSE,
  }),
  antithesis: makeProposition({
    id: 'prop-long-term',
    statement: '长期目标B',
    confidenceTrit: T_TRUE,
  }),
  contradictionType: 'non_antagonistic',
  priority: 0.3,
});

// ─── 标准实践上下文 ───

export const physicsContext = makePracticeContext({
  domain: 'physics',
  hypothesis: makeProposition({
    id: 'prop-unification',
    statement: '量子力学与相对论在某种条件下可统一',
    domain: 'physics',
  }),
});

export const engineeringContext = makePracticeContext({
  domain: 'engineering',
  hypothesis: makeProposition({
    id: 'prop-microservices',
    statement: '微服务架构优于单体架构',
    domain: 'engineering',
  }),
});

// ─── 标准 PW 上下文 ───

export const defensePhaseContext = makePWContext({
  totalRuntime: 0,
  currentPhaseDuration: 5000,
  powerSnapshot: {
    capabilities: { processing: 0.3 },
    opponentCapabilities: { complexity: 0.7 },
    relativeStrengthRatio: 0.43,
    strengthTrend: [0.4, 0.42, 0.43],
  },
  spiralMetrics: makeSpiralMetrics({
    totalCycles: 1,
    recentAscensionRatio: { ascension: 0.2, flat: 0.3, regression: 0.5 },
  }),
});

export const stalematePhaseContext = makePWContext({
  totalRuntime: 100000,
  currentPhaseDuration: 50000,
  powerSnapshot: {
    capabilities: { processing: 0.55, reasoning: 0.6 },
    opponentCapabilities: { complexity: 0.55 },
    relativeStrengthRatio: 1.0,
    strengthTrend: [0.8, 0.9, 1.0],
  },
  spiralMetrics: makeSpiralMetrics({
    totalCycles: 3,
    recentAscensionRatio: { ascension: 0.5, flat: 0.3, regression: 0.2 },
    recentBreakthroughs: ['发现关键突破口'],
  }),
});

export const counteroffensivePhaseContext = makePWContext({
  totalRuntime: 500000,
  currentPhaseDuration: 200000,
  powerSnapshot: {
    capabilities: { processing: 0.85, reasoning: 0.9 },
    opponentCapabilities: { complexity: 0.3 },
    relativeStrengthRatio: 2.83,
    strengthTrend: [2.0, 2.4, 2.83],
  },
  spiralMetrics: makeSpiralMetrics({
    totalCycles: 7,
    recentAscensionRatio: { ascension: 0.8, flat: 0.15, regression: 0.05 },
    recentBreakthroughs: ['核心矛盾已解决'],
  }),
});

// ─── 导出集合 ───

export const contradictionPairFixtures = {
  securityVsPerformance,
  innovationVsStability,
  centralizationVsDistribution,
  resolvedContradiction,
};

export const practiceContextFixtures = {
  physicsContext,
  engineeringContext,
};

export const pwContextFixtures = {
  defensePhaseContext,
  stalematePhaseContext,
  counteroffensivePhaseContext,
};
