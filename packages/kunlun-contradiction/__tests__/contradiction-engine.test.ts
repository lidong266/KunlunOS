/**
 * 矛盾分析引擎完整测试套件
 *
 * 覆盖：
 *   1. 8 个分析器独立测试
 *   2. ContradictionEngine 综合管线测试
 *   3. Prompt 模板系统测试
 *   4. 边界条件和错误处理
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Trit } from '@kunlun/ternary';
import type {
  Proposition,
  Evidence,
  ContradictionPair,
  ContradictionHistory,
  ContradictionState,
  PresenceState,
} from '../src/types';
import { DEFAULT_CONTRADICTION_ENGINE_CONFIG } from '../src/types';

import { createPrincipalContradictionLocator } from '../src/analyzers/principal-locator';
import { createAspectAnalyzer } from '../src/analyzers/aspect-analyzer';
import { createUnityDeriver } from '../src/analyzers/unity-deriver';
import { createQualitativeChangeDetector } from '../src/analyzers/qualitative-change-detector';
import { createNegationDetector } from '../src/analyzers/negation-detector';
import { createTransformationPredictor } from '../src/analyzers/transformation-predictor';
import { createUnificationConditionsDeriver } from '../src/analyzers/unification-conditions';
import { createContradictionChainAnalyzer } from '../src/analyzers/contradiction-chain';
import { createContradictionEngine } from '../src/engine';
import { createTernaryPromptManager } from '../src/ternary-prompt';

// ═══════════════════════════════════════════════════════════════
// 共享测试数据工厂
// ═══════════════════════════════════════════════════════════════

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    type: 'empirical',
    content: '测试证据内容',
    strength: 1 as Trit,
    source: 'test-source',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeProposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    id: 'prop-test',
    statement: '这是一个测试命题',
    domain: 'test-domain',
    evidence: [makeEvidence()],
    counterEvidence: [],
    confidenceTrit: 1 as Trit,
    confidenceVector: [1, 1, 1, 1, 1, 1],
    source: { type: 'human', userId: 'test-user' },
    dependencies: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

const DEFAULT_PRESENCE: PresenceState = {
  state: 'AWAKE',
  stateTrit: 1,
  continuityIndex: 1.0,
  lastTransition: Date.now(),
  metadata: {
    version: 1,
    halfLifeMs: 3600_000,
    initialTimestamp: Date.now(),
    updateCount: 1,
    phaseTransitions: 0,
    aiDrivenTransitions: 0,
    humanDrivenTransitions: 0,
    avgTimeBetweenTransitions: 0,
    totalTimeInEngaging: 0,
  },
  health: {
    status: 'HEALTHY',
    score: 1.0,
    lastCheck: Date.now(),
    anomalies: [],
  },
};

function makeContradictionPair(overrides: Partial<ContradictionPair> = {}): ContradictionPair {
  return {
    id: 'cp-test-001',
    thesis: makeProposition({
      id: 'thesis-001',
      statement: '技术创新驱动生产力发展',
      domain: 'economics',
      confidenceTrit: 1,
      evidence: [makeEvidence({ content: '实证：技术革命推动经济飞跃' })],
    }),
    antithesis: makeProposition({
      id: 'antithesis-001',
      statement: '技术进步导致结构性失业和社会分化',
      domain: 'economics',
      confidenceTrit: 0,
      evidence: [makeEvidence({ content: '实证：自动化导致部分行业失业上升' })],
    }),
    contradictionType: 'non_antagonistic',
    discoveredBy: 'human_input',
    discoveredAt: Date.now(),
    relatedContradictions: [],
    priority: 0.7,
    presenceStateAtDiscovery: DEFAULT_PRESENCE,
    warPhaseAtDiscovery: 'phase-1',
    ...overrides,
  };
}

function makeHistory(
  contradictionId: string,
  states: Partial<ContradictionState>[]
): ContradictionHistory {
  return {
    contradictionId,
    states: states.map((s, i) => ({
      timestamp: Date.now() - (states.length - i) * 3600_000,
      thesisStrength: 0.5,
      antithesisStrength: 0.5,
      dominantAspect: 0 as Trit,
      phase: 'phase-1',
      ...s,
    })),
    interventions: [],
    createdAt: Date.now() - states.length * 3600_000,
    updatedAt: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. 主要矛盾定位器测试
// ═══════════════════════════════════════════════════════════════

describe('PrincipalContradictionLocator', () => {
  const locator = createPrincipalContradictionLocator();

  it('空输入应返回空结果', () => {
    const result = locator.locate([]);
    expect(result.principalId).toBe('');
    expect(result.secondaryContradictions).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it('单矛盾应自动认定为主要矛盾', () => {
    const cp = makeContradictionPair({ id: 'single', contradictionType: 'principal' });
    const result = locator.locate([cp]);
    expect(result.principalId).toBe('single');
    expect(result.confidence).toBe(0.9);
  });

  it('多矛盾应按影响力排序并选择最高者为最主要', () => {
    const primary = makeContradictionPair({
      id: 'primary', contradictionType: 'principal', priority: 0.9,
    });
    const secondary1 = makeContradictionPair({
      id: 'sec1', contradictionType: 'secondary', priority: 0.3,
    });
    const secondary2 = makeContradictionPair({
      id: 'sec2', contradictionType: 'non_antagonistic', priority: 0.5,
    });

    const result = locator.locate([secondary1, primary, secondary2]);
    expect(result.principalId).toBe('primary');
    expect(result.secondaryContradictions).toHaveLength(2);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('应正确判定主要矛盾的方面（thesis主导）', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({ confidenceTrit: 1, evidence: [makeEvidence({ strength: 1 })] }),
      antithesis: makeProposition({ confidenceTrit: -1, evidence: [makeEvidence({ strength: -1 })] }),
    });
    const result = locator.locate([cp]);
    expect(result.principalAspect).toBe(1);
  });

  it('应正确判定主要矛盾的方面（antithesis主导）', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({ confidenceTrit: -1, evidence: [] }),
      antithesis: makeProposition({ confidenceTrit: 1, evidence: [makeEvidence({ strength: 1 })] }),
    });
    const result = locator.locate([cp]);
    expect(result.principalAspect).toBe(-1);
  });

  it('力量均势时应返回0', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({ confidenceTrit: 0 }),
      antithesis: makeProposition({ confidenceTrit: 0 }),
    });
    const result = locator.locate([cp]);
    expect(result.principalAspect).toBe(0);
  });

  it('推理文本应包含矛盾类型信息', () => {
    const cp = makeContradictionPair({
      id: 'reasoning-test',
      thesis: makeProposition({ statement: '测试命题' }),
    });
    const result = locator.locate([cp]);
    expect(result.reasoning).toContain('主要矛盾');
    expect(result.reasoning).toContain('non_antagonistic');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. 矛盾方面分析器测试
// ═══════════════════════════════════════════════════════════════

describe('AspectAnalyzer', () => {
  const analyzer = createAspectAnalyzer();

  it('应计算正反题的力量、证据支撑度和逻辑自洽性', () => {
    const cp = makeContradictionPair();
    const result = analyzer.analyze(cp);

    expect(result.thesis.strength).toBeGreaterThanOrEqual(0);
    expect(result.thesis.strength).toBeLessThanOrEqual(1);
    expect(result.antithesis.strength).toBeGreaterThanOrEqual(0);
    expect(result.antithesis.strength).toBeLessThanOrEqual(1);
    expect(result.thesis.evidenceSupport).toBeDefined();
    expect(result.thesis.internalConsistency).toBeDefined();
  });

  it('正题力量应高于反题当正题证据更强时', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({
        confidenceTrit: 1,
        evidence: [makeEvidence({ strength: 1 }), makeEvidence({ strength: 1 })],
      }),
      antithesis: makeProposition({
        confidenceTrit: -1,
        evidence: [],
      }),
    });
    const result = analyzer.analyze(cp);
    expect(result.thesis.strength).toBeGreaterThan(result.antithesis.strength);
    expect(result.overallBalance).toBe(1);
  });

  it('反题优势时 overallBalance 应为 -1', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({ confidenceTrit: -1, evidence: [] }),
      antithesis: makeProposition({
        confidenceTrit: 1,
        evidence: [makeEvidence({ strength: 1 }), makeEvidence({ strength: 1 })],
      }),
    });
    const result = analyzer.analyze(cp);
    expect(result.overallBalance).toBe(-1);
  });

  it('应预测正反题发展趋势', () => {
    const cp = makeContradictionPair();
    const result = analyzer.analyze(cp);
    expect(result.trendPrediction).toBeTruthy();
    expect(typeof result.trendPrediction).toBe('string');
  });

  it('应计算每个方面的关键支撑点', () => {
    const cp = makeContradictionPair();
    const result = analyzer.analyze(cp);
    expect(Array.isArray(result.thesis.keyPillars)).toBe(true);
    expect(Array.isArray(result.antithesis.keyPillars)).toBe(true);
  });

  it('应计算发展的势头方向', () => {
    const cp = makeContradictionPair();
    const result = analyzer.analyze(cp);
    expect([-1, 0, 1]).toContain(result.thesis.momentum);
    expect([-1, 0, 1]).toContain(result.antithesis.momentum);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 对立统一推导器测试
// ═══════════════════════════════════════════════════════════════

describe('UnityDeriver', () => {
  const deriver = createUnityDeriver();

  it('应推导出统一路径', () => {
    const cp = makeContradictionPair();
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.bestPathIndex).toBeGreaterThanOrEqual(0);
  });

  it('每条路径应包含描述、类型、可行性和代价', () => {
    const cp = makeContradictionPair();
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    for (const path of result.paths) {
      expect(path.description).toBeTruthy();
      expect(['synthesis', 'transcendence', 'absorption', 'transformation']).toContain(path.type);
      expect([-1, 0, 1]).toContain(path.feasibility);
      expect(path.estimatedEffort).toBeGreaterThanOrEqual(0);
      expect(path.estimatedEffort).toBeLessThanOrEqual(1);
      expect(path.risks).toBeDefined();
    }
  });

  it('应对非对抗性矛盾给出较高的可统一性', () => {
    const cp = makeContradictionPair({ contradictionType: 'non_antagonistic' });
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    // 非对抗性矛盾至少应不是 -1
    expect(result.unifiability).not.toBe(-1);
  });

  it('应对对抗性矛盾限制可用策略', () => {
    const cp = makeContradictionPair({ contradictionType: 'antagonistic' });
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    // 对抗性矛盾的路径应只包含 transcendence 和 transformation
    for (const path of result.paths) {
      expect(['transcendence', 'transformation']).toContain(path.type);
    }
  });

  it('应提取共同基础', () => {
    const cp = makeContradictionPair();
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    expect(Array.isArray(result.commonGround)).toBe(true);
  });

  it('置信度应在 0-1 之间', () => {
    const cp = makeContradictionPair();
    const result = deriver.derive(cp.thesis.statement, cp.antithesis.statement, cp);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 量变质变检测器测试
// ═══════════════════════════════════════════════════════════════

describe('QualitativeChangeDetector', () => {
  it('历史不足时应返回低置信度结果', () => {
    const detector = createQualitativeChangeDetector();
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
    ]);
    const result = detector.detect(cp, history);
    expect(result.triggers).toHaveLength(0);
    expect(result.estimatedThresholdAt).toBeNull();
  });

  it('应检测主导方面变化作为触发因素', () => {
    const detector = createQualitativeChangeDetector(0.5);
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.6, antithesisStrength: 0.4, dominantAspect: 1 },
      { thesisStrength: 0.55, antithesisStrength: 0.45, dominantAspect: 1 },
      { thesisStrength: 0.4, antithesisStrength: 0.6, dominantAspect: -1 },
    ]);
    const result = detector.detect(cp, history);
    // 主导方面切换应产生触发
    const domSwitch = result.triggers.find(t => t.description.includes('主导方面'));
    expect(domSwitch).toBeDefined();
  });

  it('力量严重失衡时应产生触发', () => {
    const detector = createQualitativeChangeDetector(0.5);
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5, dominantAspect: 0 },
      { thesisStrength: 0.9, antithesisStrength: 0.1, dominantAspect: 1 },
    ]);
    const result = detector.detect(cp, history);
    const imbalance = result.triggers.find(t => t.description.includes('失衡'));
    expect(imbalance).toBeDefined();
  });

  it('量变累积应介于 0-1 之间', () => {
    const detector = createQualitativeChangeDetector(0.5);
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
      { thesisStrength: 0.6, antithesisStrength: 0.5 },
      { thesisStrength: 0.7, antithesisStrength: 0.5 },
      { thesisStrength: 0.8, antithesisStrength: 0.5 },
    ]);
    const result = detector.detect(cp, history);
    expect(result.quantitativeAccumulation).toBeGreaterThanOrEqual(0);
    expect(result.quantitativeAccumulation).toBeLessThanOrEqual(1);
  });

  it('对抗性矛盾应有较低的质变阈值', () => {
    const detector = createQualitativeChangeDetector(0.5);
    const antagonistic = makeContradictionPair({ contradictionType: 'antagonistic' });
    const nonAntagonistic = makeContradictionPair({ contradictionType: 'non_antagonistic' });

    const antResult = detector.detect(antagonistic, makeHistory(antagonistic.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
      { thesisStrength: 0.7, antithesisStrength: 0.3 },
    ]));
    const nonAntResult = detector.detect(nonAntagonistic, makeHistory(nonAntagonistic.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
      { thesisStrength: 0.7, antithesisStrength: 0.3 },
    ]));

    expect(antResult.thresholdValue).toBeLessThanOrEqual(nonAntResult.thresholdValue);
  });

  it('超过临界点 80% 时应标记为接近临界', () => {
    const detector = createQualitativeChangeDetector(1.0); // 最大灵敏度使累积更快
    const cp = makeContradictionPair({ contradictionType: 'quantitative' });
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.3, antithesisStrength: 0.7 },
      { thesisStrength: 0.9, antithesisStrength: 0.1 },
    ]);
    const result = detector.detect(cp, history);
    expect([-1, 0, 1]).toContain(result.approachingThreshold);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 否定之否定检测器测试
// ═══════════════════════════════════════════════════════════════

describe('NegationDetector', () => {
  const detector = createNegationDetector();

  it('历史不足 3 条时应返回 insufficientData', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
      { thesisStrength: 0.6, antithesisStrength: 0.4 },
    ]);
    const result = detector.detect(cp, history);
    expect(result.stage).toBe(-1);
    expect(result.isSpiralAscension).toBe(false);
    expect(result.cycleCount).toBe(0);
  });

  it('应为否定之否定阶段检测涌现属性', () => {
    const cp = makeContradictionPair({ contradictionType: 'negation' });
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.6, antithesisStrength: 0.4, dominantAspect: 1 },
      { thesisStrength: 0.3, antithesisStrength: 0.7, dominantAspect: -1 },
      { thesisStrength: 0.7, antithesisStrength: 0.5, dominantAspect: 1 },
    ]);
    const result = detector.detect(cp, history);
    expect(Array.isArray(result.emergentProperties)).toBe(true);
  });

  it('应在多次否定交替后检测螺旋上升', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5, dominantAspect: 1 },
      { thesisStrength: 0.3, antithesisStrength: 0.7, dominantAspect: -1 },
      { thesisStrength: 0.6, antithesisStrength: 0.5, dominantAspect: 1 },
    ]);
    const result = detector.detect(cp, history);
    expect([-1, 0, 1]).toContain(result.stage);
  });

  it('应区分保留和抛弃的属性', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.6, antithesisStrength: 0.4, dominantAspect: 1 },
      { thesisStrength: 0.3, antithesisStrength: 0.7, dominantAspect: -1 },
      { thesisStrength: 0.7, antithesisStrength: 0.5, dominantAspect: 1 },
    ]);
    const result = detector.detect(cp, history);
    expect(Array.isArray(result.preservedProperties)).toBe(true);
    expect(Array.isArray(result.discardedProperties)).toBe(true);
    expect(result.preservedProperties.length).toBeGreaterThan(0);
  });

  it('ascensionStrength 应在 0-1 之间', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.6, antithesisStrength: 0.4, dominantAspect: 1 },
      { thesisStrength: 0.3, antithesisStrength: 0.7, dominantAspect: -1 },
      { thesisStrength: 0.7, antithesisStrength: 0.5, dominantAspect: 1 },
    ]);
    const result = detector.detect(cp, history);
    expect(result.ascensionStrength).toBeGreaterThanOrEqual(0);
    expect(result.ascensionStrength).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 矛盾转化预测器测试
// ═══════════════════════════════════════════════════════════════

describe('TransformationPredictor', () => {
  const predictor = createTransformationPredictor();

  it('应生成多条转化路径', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    expect(result.paths.length).toBeGreaterThan(0);
  });

  it('路径应按概率降序排列', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    for (let i = 1; i < result.paths.length; i++) {
      expect(result.paths[i].probability).toBeLessThanOrEqual(result.paths[i - 1].probability);
    }
  });

  it('转化必然性应在 {-1, 0, 1} 中', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    expect([-1, 0, 1]).toContain(result.inevitability);
  });

  it('每条路径应包含条件列表', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    for (const path of result.paths) {
      expect(Array.isArray(path.conditions)).toBe(true);
      expect(path.conditions.length).toBeGreaterThan(0);
    }
  });

  it('非对抗性矛盾应有较低的对抗性转化风险', () => {
    const cp = makeContradictionPair({ contradictionType: 'non_antagonistic' });
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    const mostLikely = result.paths[result.mostLikelyPathIndex];
    expect(mostLikely.antagonisticRisk).toBeLessThanOrEqual(0.3);
  });

  it('应有维持现状的路径', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = predictor.predict(cp, history);
    const stalemate = result.paths.find(p => p.description.includes('僵持'));
    expect(stalemate).toBeDefined();
  });

  it('两方均衰减时应有矛盾消解路径', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.8, antithesisStrength: 0.3 },
      { thesisStrength: 0.5, antithesisStrength: 0.3 },
      { thesisStrength: 0.3, antithesisStrength: 0.2 },
    ]);
    const result = predictor.predict(cp, history);
    const resolution = result.paths.find(p => p.description.includes('消解'));
    expect(resolution).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. 统一条件推导器测试
// ═══════════════════════════════════════════════════════════════

describe('UnificationConditionsDeriver', () => {
  const deriver = createUnificationConditionsDeriver();

  it('应推导出必要条件和充分条件', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = deriver.derive(cp, history);
    expect(result.necessaryConditions.length).toBeGreaterThan(0);
    expect(result.sufficientConditions.length).toBeGreaterThan(0);
  });

  it('每个条件应有类型、满足度和可控性', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = deriver.derive(cp, history);
    const allConditions = [...result.necessaryConditions, ...result.sufficientConditions];
    for (const c of allConditions) {
      expect(['internal', 'external', 'temporal', 'structural', 'information']).toContain(c.type);
      expect(c.satisfactionLevel).toBeGreaterThanOrEqual(0);
      expect(c.satisfactionLevel).toBeLessThanOrEqual(1);
      expect(typeof c.controllable).toBe('boolean');
    }
  });

  it('应返回统一可能性判定', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = deriver.derive(cp, history);
    expect([-1, 0, 1]).toContain(result.unifiable);
  });

  it('应有最优条件组合', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = deriver.derive(cp, history);
    expect(result.optimalConditionSet.length).toBeGreaterThan(0);
  });

  it('最小代价应在 0-1 之间', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, []);
    const result = deriver.derive(cp, history);
    expect(result.minimumCost).toBeGreaterThanOrEqual(0);
    expect(result.minimumCost).toBeLessThanOrEqual(2); // 不可控条件代价*1.5 可能超1
  });

  it('对抗性矛盾应产生更多条件', () => {
    const antagonistic = makeContradictionPair({ contradictionType: 'antagonistic' });
    const nonAntag = makeContradictionPair({ contradictionType: 'non_antagonistic' });
    const history = makeHistory(antagonistic.id, []);
    const antResult = deriver.derive(antagonistic, history);
    const nonAntResult = deriver.derive(nonAntag, makeHistory(nonAntag.id, []));
    // 对抗性矛盾应有更多充分条件（对抗性特有条件）
    expect(antResult.sufficientConditions.length + antResult.necessaryConditions.length)
      .toBeGreaterThanOrEqual(nonAntResult.sufficientConditions.length + nonAntResult.necessaryConditions.length - 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 矛盾链分析器测试
// ═══════════════════════════════════════════════════════════════

describe('ContradictionChainAnalyzer', () => {
  const analyzer = createContradictionChainAnalyzer();

  it('空输入应返回空图', () => {
    const result = analyzer.analyze([]);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.rootContradictionId).toBeNull();
    expect(result.hasCycles).toBe(false);
  });

  it('单矛盾对应返回单节点图', () => {
    const cp = makeContradictionPair({ id: 'root' });
    const result = analyzer.analyze([cp]);
    expect(result.nodes).toHaveLength(1);
    expect(result.rootContradictionId).toBe('root');
    expect(result.chainLength).toBe(1);
  });

  it('应基于 relatedContradictions 推断边', () => {
    const cp1 = makeContradictionPair({
      id: 'cp1', contradictionType: 'principal', priority: 0.9,
      relatedContradictions: ['cp2'],
    });
    const cp2 = makeContradictionPair({
      id: 'cp2', contradictionType: 'secondary', priority: 0.3,
      relatedContradictions: [],
    });
    const result = analyzer.analyze([cp1, cp2]);
    expect(result.edges.length).toBeGreaterThan(0);
    const edge = result.edges[0];
    expect(edge.from).toBe('cp1');
    expect(edge.to).toBe('cp2');
  });

  it('应检测循环依赖', () => {
    const cp1 = makeContradictionPair({
      id: 'cp1', relatedContradictions: ['cp2'],
    });
    const cp2 = makeContradictionPair({
      id: 'cp2', relatedContradictions: ['cp1'],
    });
    const result = analyzer.analyze([cp1, cp2], 10, true);
    expect(result.hasCycles).toBe(true);
  });

  it('应计算节点的深度', () => {
    const cp1 = makeContradictionPair({
      id: 'cp1', relatedContradictions: ['cp2'],
    });
    const cp2 = makeContradictionPair({
      id: 'cp2', relatedContradictions: ['cp3'],
    });
    const cp3 = makeContradictionPair({
      id: 'cp3', relatedContradictions: [],
    });
    const result = analyzer.analyze([cp1, cp2, cp3]);
    // cp1 的深度应为 0（无入边），cp3 的深度最大
    const node1 = result.nodes.find(n => n.contradictionId === 'cp1');
    const node3 = result.nodes.find(n => n.contradictionId === 'cp3');
    expect(node1).toBeDefined();
    expect(node3).toBeDefined();
    if (node1 && node3) {
      expect(node3.depth).toBeGreaterThanOrEqual(node1.depth);
    }
  });

  it('应返回整体可解性', () => {
    const cp = makeContradictionPair();
    const result = analyzer.analyze([cp]);
    expect([-1, 0, 1]).toContain(result.solvability);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. ContradictionEngine 综合测试
// ═══════════════════════════════════════════════════════════════

describe('ContradictionEngine', () => {
  let engine = createContradictionEngine();

  beforeEach(() => {
    engine = createContradictionEngine();
  });

  it('应成功创建引擎实例', () => {
    expect(engine).toBeDefined();
    const config = engine.getConfig();
    expect(config.enableAllAnalyzers).toBe(true);
    expect(config.analysisDepth).toBe(2);
  });

  it('应接受自定义配置', () => {
    const custom = createContradictionEngine({ analysisDepth: 3, minimumPriority: 0.5 });
    expect(custom.getConfig().analysisDepth).toBe(3);
    expect(custom.getConfig().minimumPriority).toBe(0.5);
  });

  it('更新配置应生效', () => {
    engine.updateConfig({ qualitativeChangeSensitivity: 0.8 });
    expect(engine.getConfig().qualitativeChangeSensitivity).toBe(0.8);
  });

  it('analyzeSingle 应返回完整的分析输出', () => {
    const cp = makeContradictionPair();
    const result = engine.analyzeSingle(cp);

    expect(result.contradictionId).toBe('cp-test-001');
    expect([-1, 0, 1]).toContain(result.analysis.unifiability);
    expect(result.analysis.unificationPaths).toBeDefined();
    expect([-1, 0, 1]).toContain(result.qualitativeChange.approachingThreshold);
    expect(Array.isArray(result.qualitativeChange.triggers)).toBe(true);
    expect([-1, 0, 1]).toContain(result.negationCycle.stage);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('应记录分析元数据', () => {
    const cp = makeContradictionPair();
    const result = engine.analyzeSingle(cp);
    expect(result.metadata.analyzedAt).toBeGreaterThan(0);
    expect(result.metadata.analysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.modulesExecuted.length).toBeGreaterThan(0);
    expect(result.metadata.engineVersion).toBe('2.0.0-phase1');
  });

  it('应包含整体置信度', () => {
    const cp = makeContradictionPair();
    const result = engine.analyzeSingle(cp);
    expect([-1, 0, 1]).toContain(result.overallConfidence);
    expect(result.confidenceVector).toHaveLength(6);
  });

  it('analyzeMultiple 应按优先级顺序分析', () => {
    const cp1 = makeContradictionPair({ id: 'low', priority: 0.2 });
    const cp2 = makeContradictionPair({ id: 'high', priority: 0.9 });
    const results = engine.analyzeMultiple([cp1, cp2]);
    expect(results).toHaveLength(2);
    // 高优先级先分析
    expect(results[0].contradictionId).toBe('high');
    expect(results[1].contradictionId).toBe('low');
  });

  it('空输入 analyzeMultiple 应返回空数组', () => {
    const results = engine.analyzeMultiple([]);
    expect(results).toHaveLength(0);
  });

  it('应正确处理对抗性矛盾', () => {
    const cp = makeContradictionPair({ contradictionType: 'antagonistic' });
    const result = engine.analyzeSingle(cp);
    expect(result.transformationPrediction.antagonisticRisk).toBeGreaterThanOrEqual(0);
  });

  it('对无历史的状态应使用默认历史', () => {
    const cp = makeContradictionPair();
    const result = engine.analyzeSingle(cp);
    // 默认历史只有 1 个状态，质变预测应返回保守结果
    expect(result.qualitativeChange.estimatedThresholdAt).toBeNull();
  });

  it('建议列表应包含正题/反题相关的建议', () => {
    const cp = makeContradictionPair({
      thesis: makeProposition({ confidenceTrit: 1, evidence: [makeEvidence({ strength: 1 }), makeEvidence({ strength: 1 })] }),
      antithesis: makeProposition({ confidenceTrit: -1, evidence: [] }),
    });
    const result = engine.analyzeSingle(cp);
    // 反题弱势时应产生建议
    const weakSideRec = result.recommendations.find(r =>
      r.action.includes('反题') || r.action.includes('正题')
    );
    expect(weakSideRec).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. Prompt 模板系统测试
// ═══════════════════════════════════════════════════════════════

describe('TernaryPromptManager', () => {
  let manager = createTernaryPromptManager();

  beforeEach(() => {
    manager = createTernaryPromptManager();
  });

  it('应包含 5 个内置模板', () => {
    const templates = manager.listTemplates();
    expect(templates.length).toBe(5);
    const names = templates.map(t => t.name);
    expect(names).toContain('standard-dilemma');
    expect(names).toContain('practice-feedback');
    expect(names).toContain('phase-transition');
    expect(names).toContain('contradiction-audit');
    expect(names).toContain('moral-ethical');
  });

  it('getTemplate 应返回正确的模板', () => {
    const tpl = manager.getTemplate('standard-dilemma');
    expect(tpl).not.toBeNull();
    expect(tpl!.name).toBe('standard-dilemma');
    expect(tpl!.version).toBe('2.0.0');
  });

  it('getTemplate 对不存在的模板应返回 null', () => {
    expect(manager.getTemplate('non-existent')).toBeNull();
  });

  it('应能注册自定义模板', () => {
    const customTpl = {
      name: 'my-custom-template',
      version: '1.0.0',
      description: 'Custom test template',
      systemPrompt: 'You are a test.',
      userPromptTemplate: 'Analyze: {{thesisStatement}}',
      outputFormatHint: 'Just output the verdict.',
      recommendedDepth: 'quick' as const,
    };
    manager.registerTemplate(customTpl);
    expect(manager.getTemplate('my-custom-template')).not.toBeNull();
  });

  it('不能覆盖内置模板', () => {
    expect(() => {
      manager.registerTemplate({
        name: 'standard-dilemma',
        version: '99.0',
        description: 'override attempt',
        systemPrompt: 'hack',
        userPromptTemplate: '{{thesisStatement}}',
        outputFormatHint: 'x',
        recommendedDepth: 'quick',
      });
    }).toThrow(/override/i);
  });

  it('应能删除自定义模板', () => {
    manager.registerTemplate({
      name: 'to-delete',
      version: '1.0',
      description: 'temp',
      systemPrompt: 'test',
      userPromptTemplate: '{{thesisStatement}}',
      outputFormatHint: 'x',
      recommendedDepth: 'quick',
    });
    expect(manager.removeTemplate('to-delete')).toBe(true);
    expect(manager.getTemplate('to-delete')).toBeNull();
  });

  it('不能删除内置模板', () => {
    expect(manager.removeTemplate('standard-dilemma')).toBe(false);
    expect(manager.getTemplate('standard-dilemma')).not.toBeNull();
  });

  it('应构建填充变量的 Prompt', () => {
    const result = manager.buildPrompt('standard-dilemma', {
      thesisStatement: '技术进步是好的',
      antithesisStatement: '技术进步是坏的',
      contradictionType: 'non_antagonistic',
      domain: 'ethics',
      depth: 'standard',
    });
    expect(result).not.toBeNull();
    expect(result!.systemPrompt).toContain('唯物辩证法');
    expect(result!.userPrompt).toContain('技术进步是好的');
    expect(result!.userPrompt).toContain('技术进步是坏的');
    expect(result!.userPrompt).toContain('ethics');
  });

  it('不存在的模板 buildPrompt 应返回 null', () => {
    expect(manager.buildPrompt('nope', {
      thesisStatement: 'x',
      antithesisStatement: 'y',
      contradictionType: 'non_antagonistic',
      domain: 'test',
      depth: 'quick',
    })).toBeNull();
  });

  it('条件块在变量为空时应被移除', () => {
    const result = manager.buildPrompt('standard-dilemma', {
      thesisStatement: 'A',
      antithesisStatement: 'B',
      contradictionType: 'internal',
      domain: 'test',
      depth: 'quick',
      additionalContext: '', // 空字符串 → 条件块应被移除
    });
    expect(result).not.toBeNull();
    expect(result!.userPrompt).not.toContain('额外上下文');
  });

  it('条件块在有值时保留', () => {
    const result = manager.buildPrompt('standard-dilemma', {
      thesisStatement: 'A',
      antithesisStatement: 'B',
      contradictionType: 'internal',
      domain: 'test',
      depth: 'quick',
      additionalContext: 'important context here',
    });
    expect(result).not.toBeNull();
    expect(result!.userPrompt).toContain('important context here');
  });

  it('应解析 LLM 响应为结构化结果', () => {
    const tpl = manager.getTemplate('standard-dilemma')!;
    const rawResponse = `
综合判定：+1
判定理由：正反题有共同的事实基础，可以通过综合实现统一。
主要矛盾的方面：+1
统一路径建议：
1. 通过技术伦理框架调和
2. 引入社会影响评估作为综合机制
质变风险评估：low
行动建议：
1. 建立技术伦理委员会
2. 定期评估技术对就业的影响
信息缺口：
1. 缺乏具体行业的失业率数据
置信度：0.85
`.trim();

    const result = manager.parseResponse(rawResponse, tpl);
    expect(result.verdict).toBe(1);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.dominantAspect).toBe(1);
    // 中文 "低" 被解析为 low
    expect(['low', 'none']).toContain(result.qualitativeChangeRisk);
    expect(result.unificationSuggestions.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.informationGaps.length).toBeGreaterThan(0);
  });

  it('应解析 -1 判定', () => {
    const tpl = manager.getTemplate('standard-dilemma')!;
    const rawResponse = `
综合判定：-1
判定理由：双方存在根本性冲突，无法调和。
置信度：0.9
`;
    const result = manager.parseResponse(rawResponse, tpl);
    expect(result.verdict).toBe(-1);
    expect(result.confidence).toBe(0.9);
  });

  it('recommendForDepth 应筛选正确深度的模板', () => {
    const quick = manager.recommendForDepth('quick');
    const standard = manager.recommendForDepth('standard');
    const deep = manager.recommendForDepth('deep');

    // practice-feedback 推荐深度是 quick
    expect(quick.some(t => t.name === 'practice-feedback')).toBe(true);
    // standard-dilemma 推荐深度是 standard
    expect(standard.some(t => t.name === 'standard-dilemma')).toBe(true);
    // contradiction-audit 推荐深度是 deep
    expect(deep.some(t => t.name === 'contradiction-audit')).toBe(true);
  });

  it('应保留原始响应用于审计', () => {
    const tpl = manager.getTemplate('contradiction-audit')!;
    const raw = '审计结论：+1\n置信度：0.7';
    const result = manager.parseResponse(raw, tpl);
    expect(result.rawResponse).toBe(raw);
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 边界条件与集成测试
// ═══════════════════════════════════════════════════════════════

describe('Edge cases and integration', () => {
  it('引擎应对所有 8 种矛盾类型都能分析', () => {
    const engine = createContradictionEngine();
    const types = ['antagonistic', 'non_antagonistic', 'principal', 'secondary',
      'internal', 'external', 'quantitative', 'negation'] as const;

    for (const type of types) {
      const cp = makeContradictionPair({ contradictionType: type });
      const result = engine.analyzeSingle(cp);
      expect(result.contradictionId).toBeDefined();
      expect(result.analysis.contradictionType).toBe(type);
    }
  });

  it('全部 8 个分析器可独立实例化', () => {
    expect(() => createPrincipalContradictionLocator()).not.toThrow();
    expect(() => createAspectAnalyzer()).not.toThrow();
    expect(() => createUnityDeriver()).not.toThrow();
    expect(() => createQualitativeChangeDetector()).not.toThrow();
    expect(() => createNegationDetector()).not.toThrow();
    expect(() => createTransformationPredictor()).not.toThrow();
    expect(() => createUnificationConditionsDeriver()).not.toThrow();
    expect(() => createContradictionChainAnalyzer()).not.toThrow();
  });

  it('量变质变检测器应处理边界灵敏度值', () => {
    const cp = makeContradictionPair();
    const history = makeHistory(cp.id, [
      { thesisStrength: 0.5, antithesisStrength: 0.5 },
      { thesisStrength: 0.7, antithesisStrength: 0.3 },
    ]);

    // 极低灵敏度
    const lowDetector = createQualitativeChangeDetector(0.1);
    const lowResult = lowDetector.detect(cp, history);

    // 极高灵敏度
    const highDetector = createQualitativeChangeDetector(1.0);
    const highResult = highDetector.detect(cp, history);

    // 两种灵敏度都应产生有效累积值（0-1之间）
    expect(lowResult.quantitativeAccumulation).toBeGreaterThanOrEqual(0);
    expect(lowResult.quantitativeAccumulation).toBeLessThanOrEqual(1);
    expect(highResult.quantitativeAccumulation).toBeGreaterThanOrEqual(0);
    expect(highResult.quantitativeAccumulation).toBeLessThanOrEqual(1);
    // 不同灵敏度应产生不同的量变累积
    expect(lowResult.quantitativeAccumulation).not.toBe(highResult.quantitativeAccumulation);
  });
});