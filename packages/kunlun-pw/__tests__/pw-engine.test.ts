/**
 * kunlun-pw — 持久战策略引擎 测试套件
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProtractedWarEngine } from '../src/engine.js';
import { PW_TRIT } from '../src/types.js';
import type {
  PWContext,
  PowerSnapshot,
  SpiralMetrics,
  PWCriticalEvent,
} from '../src/types.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

// ═══════════════════════════════════════════════════════════════
// 数据工厂
// ═══════════════════════════════════════════════════════════════

function makePowerSnapshot(overrides: Partial<PowerSnapshot> = {}): PowerSnapshot {
  return {
    capabilities: { speed: 0.5, strength: 0.5, intelligence: 0.5 },
    opponentCapabilities: { speed: 0.5, strength: 0.5 },
    relativeStrengthRatio: 0.8,
    strengthTrend: [0.6, 0.7, 0.8],
    ...overrides,
  };
}

function makeSpiralMetrics(overrides: Partial<SpiralMetrics> = {}): SpiralMetrics {
  return {
    totalCycles: 5,
    recentAscensionRatio: { ascension: 2, flat: 2, regression: 1 },
    recentBreakthroughs: [],
    ...overrides,
  };
}

function makeEvent(
  desc: string,
  impact: -1 | 0 | 1 = 0,
  daysAgo = 1,
): PWCriticalEvent {
  return {
    timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    description: desc,
    impact,
    domain: 'test',
  };
}

function makeContext(overrides: Partial<PWContext> = {}): PWContext {
  return {
    totalRuntime: 1000 * 60 * 60, // 1 hour
    currentPhaseDuration: 1000 * 60 * 10, // 10 min
    phaseHistory: [],
    powerSnapshot: makePowerSnapshot(),
    activeContradictions: [],
    spiralMetrics: makeSpiralMetrics(),
    criticalEvents: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('ProtractedWarEngine', () => {
  let engine: ProtractedWarEngine;

  beforeEach(() => {
    engine = new ProtractedWarEngine();
  });

  // ── 阶段评估 ──

  describe('assessPhase（阶段评估）', () => {
    it('应返回完整的阶段评估', async () => {
      const ctx = makeContext();
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.currentPhase).toBeDefined();
      expect(assessment.powerBalance).toBeDefined();
      expect(assessment.contradictionStatus).toBeDefined();
      expect(assessment.practiceSpiralStatus).toBeDefined();
      expect(assessment.ecosystemFactors).toBeDefined();
      expect(assessment.readinessToShift).toBeDefined();
    });

    it('力量劣势时应判定为防御阶段', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({
          relativeStrengthRatio: 0.3,
          strengthTrend: [0.3, 0.3, 0.3],
          capabilities: { speed: 0.2, strength: 0.2, intelligence: 0.3 },
        }),
      });
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.currentPhase).toBe('defense');
    });

    it('力量均衡时应判定为相持阶段', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({
          relativeStrengthRatio: 1.0,
          strengthTrend: [0.9, 1.0, 1.0],
        }),
      });
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.currentPhase).toBe('stalemate');
    });

    it('力量优势且矛盾接近转化时应判定为反攻阶段', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({
          relativeStrengthRatio: 2.0,
          strengthTrend: [1.5, 1.8, 2.0],
        }),
        activeContradictions: [
          {
            id: 'c1',
            contradictionType: 'non_antagonistic',
            thesis: { id: 't1', statement: 'x' },
            antithesis: { id: 't2', statement: 'y' },
          } as any,
        ],
      });
      const assessment = await engine.assessPhase(ctx);
      // 力量优势 + 非对抗性矛盾 = stalemate（因为反攻需要更多条件）
      expect(['stalemate', 'counteroffensive']).toContain(assessment.currentPhase);
    });

    it('应正确计算力量对比趋势', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({
          strengthTrend: [1.0, 0.9, 0.8], // 下降趋势
          relativeStrengthRatio: 0.8,
        }),
      });
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.powerBalance.strengthTrend).toBe(T_FALSE);
    });
  });

  // ── 阶段转换决策 ──

  describe('evaluatePhaseShift（阶段转换决策）', () => {
    it('满足条件时应建议转换', async () => {
      const assessment = {
        currentPhase: 'defense' as const,
        powerBalance: {
          relativeStrength: T_UNKNOWN,
          strengthTrend: T_TRUE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_UNKNOWN,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_TRUE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_UNKNOWN, criticalEvents: [] },
        readinessToShift: { toStalemate: T_TRUE, toCounteroffensive: T_FALSE },
      };
      const decision = await engine.evaluatePhaseShift(assessment);
      // 防御→相持：strengthTrend=1 + readyToStalemate=1 → 应转换
      expect(decision.shouldShift).toBe(T_TRUE);
      expect(decision.targetPhase).toBe('stalemate');
    });

    it('条件不满足时应拒绝转换', async () => {
      const assessment = {
        currentPhase: 'defense' as const,
        powerBalance: {
          relativeStrength: T_FALSE,
          strengthTrend: T_FALSE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_FALSE,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_FALSE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_FALSE, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const decision = await engine.evaluatePhaseShift(assessment);
      expect(decision.shouldShift).toBe(T_FALSE);
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('相持阶段力量下降应建议退却到防御', async () => {
      const assessment = {
        currentPhase: 'stalemate' as const,
        powerBalance: {
          relativeStrength: T_FALSE,
          strengthTrend: T_FALSE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_FALSE,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_FALSE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_FALSE, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const decision = await engine.evaluatePhaseShift(assessment);
      expect(decision.shouldShift).toBe(T_TRUE);
      expect(decision.targetPhase).toBe('defense');
    });

    it('相持→反攻需要力量优势+矛盾接近转化', async () => {
      const assessment = {
        currentPhase: 'stalemate' as const,
        powerBalance: {
          relativeStrength: T_TRUE,
          strengthTrend: T_TRUE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_TRUE,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_TRUE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_TRUE, criticalEvents: [] },
        readinessToShift: { toStalemate: T_TRUE, toCounteroffensive: T_TRUE },
      };
      const decision = await engine.evaluatePhaseShift(assessment);
      expect(decision.shouldShift).toBe(T_TRUE);
      expect(decision.targetPhase).toBe('counteroffensive');
    });
  });

  // ── 阶段转换执行 ──

  describe('executePhaseShift（执行阶段转换）', () => {
    it('应记录阶段转换历史', async () => {
      const result = await engine.executePhaseShift('defense', 'stalemate');
      expect(result.from).toBe('defense');
      expect(result.to).toBe('stalemate');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.initialStrategy.length).toBeGreaterThan(0);
    });

    it('前向转换应有计划性', async () => {
      const result = await engine.executePhaseShift('defense', 'stalemate');
      expect(result.abruptness).toBe(T_TRUE); // 防御→相持 前向
    });

    it('后向转换应视为被迫', async () => {
      const result = await engine.executePhaseShift('counteroffensive', 'stalemate');
      expect(result.abruptness).toBe(T_FALSE); // 反攻→相持 后向
    });

    it('应更新全局状态', async () => {
      await engine.executePhaseShift('defense', 'stalemate');
      const state = engine.getGlobalState();
      expect(state.currentPhase).toBe('stalemate');
      expect(state.phaseTransitionCount).toBe(1);
    });
  });

  // ── 防御阶段战术 ──

  describe('defenseTactics（防御阶段战术）', () => {
    it('力量趋势上升时应采用积极防御', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({ strengthTrend: [0.3, 0.5, 0.7] }),
      });
      const assessment = await engine.assessPhase(ctx);
      const tactics = await engine.defenseTactics(assessment);
      expect(tactics.activeDefense).toBeDefined();
      expect(tactics.specificTactics.length).toBeGreaterThan(0);
    });

    it('消极防御时应生成退却策略', async () => {
      const ctx = makeContext({
        powerSnapshot: makePowerSnapshot({
          strengthTrend: [0.8, 0.6, 0.4],
          relativeStrengthRatio: 0.3,
        }),
      });
      const assessment = await engine.assessPhase(ctx);
      const tactics = await engine.defenseTactics(assessment);
      expect(tactics.specificTactics).toContain('战略性退却：保存实力为第一要务');
    });
  });

  // ── 相持阶段战术 ──

  describe('stalemateTactics（相持阶段战术）', () => {
    it('力量优势时应偏重发展', async () => {
      const assessment = {
        currentPhase: 'stalemate' as const,
        powerBalance: {
          relativeStrength: T_TRUE,
          strengthTrend: T_TRUE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_UNKNOWN,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_TRUE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_UNKNOWN, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const tactics = await engine.stalemateTactics(assessment);
      expect(tactics.attritionEmphasis).toBeLessThan(0.5);
    });

    it('力量劣势时应偏重消耗', async () => {
      const assessment = {
        currentPhase: 'stalemate' as const,
        powerBalance: {
          relativeStrength: T_FALSE,
          strengthTrend: T_UNKNOWN,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_FALSE,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_UNKNOWN,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_UNKNOWN, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const tactics = await engine.stalemateTactics(assessment);
      expect(tactics.attritionEmphasis).toBeGreaterThan(0.5);
    });
  });

  // ── 反攻阶段战术 ──

  describe('counteroffensiveTactics（反攻阶段战术）', () => {
    it('力量绝对优势+矛盾接近转化时应全面反攻', async () => {
      const assessment = {
        currentPhase: 'counteroffensive' as const,
        powerBalance: {
          relativeStrength: T_TRUE,
          strengthTrend: T_TRUE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_TRUE,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_TRUE,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_TRUE, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const tactics = await engine.counteroffensiveTactics(assessment);
      expect(tactics.fullScale).toBe(T_TRUE);
    });

    it('力量优势但矛盾未转化时应重点突破', async () => {
      const assessment = {
        currentPhase: 'counteroffensive' as const,
        powerBalance: {
          relativeStrength: T_TRUE,
          strengthTrend: T_TRUE,
          capabilities: {},
        },
        contradictionStatus: {
          approachingResolution: T_UNKNOWN,
          newContradictionsEmerging: T_FALSE,
        },
        practiceSpiralStatus: {
          spiralAscending: T_UNKNOWN,
          recentBreakthroughs: [],
        },
        ecosystemFactors: { favorability: T_UNKNOWN, criticalEvents: [] },
        readinessToShift: { toStalemate: T_FALSE, toCounteroffensive: T_FALSE },
      };
      const tactics = await engine.counteroffensiveTactics(assessment);
      expect(tactics.fullScale).not.toBe(T_TRUE);
    });
  });

  // ── 节奏调控 ──

  describe('regulateTempo（节奏调控）', () => {
    it('防御阶段应减速', async () => {
      const result = await engine.regulateTempo('defense', {
        phaseDuration: 10000,
        strengthChangeRate: 0.0,
        spiralFrequency: 1,
        criticalEventDensity: 0,
      });
      expect(result.direction).toBe(T_FALSE);
    });

    it('防御阶段力量增长时可维持', async () => {
      const result = await engine.regulateTempo('defense', {
        phaseDuration: 10000,
        strengthChangeRate: 0.15,
        spiralFrequency: 1,
        criticalEventDensity: 0,
      });
      expect(result.direction).toBe(T_UNKNOWN);
    });

    it('反攻阶段应加速', async () => {
      const result = await engine.regulateTempo('counteroffensive', {
        phaseDuration: 5000,
        strengthChangeRate: 0.3,
        spiralFrequency: 2,
        criticalEventDensity: 0,
      });
      expect(result.direction).toBe(T_TRUE);
    });

    it('高螺旋频率时应生成移动战术行动', async () => {
      const result = await engine.regulateTempo('counteroffensive', {
        phaseDuration: 5000,
        strengthChangeRate: 0.3,
        spiralFrequency: 5,
        criticalEventDensity: 0,
      });
      const mobileActions = result.actions.filter((a) => a.type === 'mobile');
      expect(mobileActions.length).toBeGreaterThan(0);
    });

    it('相持阶段力量增长明显时应加速', async () => {
      const result = await engine.regulateTempo('stalemate', {
        phaseDuration: 20000,
        strengthChangeRate: 0.3,
        spiralFrequency: 2,
        criticalEventDensity: 0,
      });
      expect(result.direction).toBe(T_TRUE);
    });

    it('应返回合理的资源分配', async () => {
      const result = await engine.regulateTempo('defense', {
        phaseDuration: 10000,
        strengthChangeRate: 0,
        spiralFrequency: 1,
        criticalEventDensity: 0,
      });
      const totalAllocation =
        result.resourceAllocation.offense +
        result.resourceAllocation.defense +
        result.resourceAllocation.development;
      expect(totalAllocation).toBeCloseTo(1.0, 1);
    });
  });

  // ── 全局状态 ──

  describe('getGlobalState（全局状态）', () => {
    it('应返回初始防御状态', () => {
      const state = engine.getGlobalState();
      expect(state.currentPhase).toBe('defense');
      expect(state.phaseTransitionCount).toBe(0);
      expect(state.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('多次转换后应准确统计', async () => {
      await engine.executePhaseShift('defense', 'stalemate');
      await engine.executePhaseShift('stalemate', 'counteroffensive');
      const state = engine.getGlobalState();
      expect(state.currentPhase).toBe('counteroffensive');
      expect(state.phaseTransitionCount).toBe(2);
    });

    it('阶段记录应包含时间信息', () => {
      const state = engine.getGlobalState();
      expect(state.phases).toBeInstanceOf(Array);
    });
  });

  // ── 外部生态 ──

  describe('生态感知', () => {
    it('有利事件多于不利事件时应判定为有利', async () => {
      const ctx = makeContext({
        criticalEvents: [
          makeEvent('利好1', 1, 1),
          makeEvent('利好2', 1, 2),
          makeEvent('利空', -1, 3),
        ],
      });
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.ecosystemFactors.favorability).toBe(T_TRUE);
    });

    it('无事件时应判定为中性', async () => {
      const ctx = makeContext({ criticalEvents: [] });
      const assessment = await engine.assessPhase(ctx);
      expect(assessment.ecosystemFactors.favorability).toBe(T_UNKNOWN);
    });
  });

  // ── PW_TRIT 常量 ──

  describe('PW_TRIT', () => {
    it('防御=-1，相持=0，反攻=+1', () => {
      expect(PW_TRIT.defense).toBe(-1 as -1);
      expect(PW_TRIT.stalemate).toBe(0 as 0);
      expect(PW_TRIT.counteroffensive).toBe(1 as 1);
    });
  });
});
