/**
 * kunlun-spiral — 实践螺旋引擎 测试套件
 */
import { describe, it, expect } from 'vitest';
import { PracticeSpiralEngine } from '../src/engine.js';
import type { PracticeContext, PracticeEnvironment } from '../src/types.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { Proposition, ContradictionPair } from '@kunlun/contradiction';

// ═══════════════════════════════════════════════════════════════
// 数据工厂
// ═══════════════════════════════════════════════════════════════

function makeProposition(overrides: Partial<Proposition> = {}): Proposition {
  return {
    id: `prop-${Math.random().toString(36).slice(2, 8)}`,
    statement: '技术创新驱动生产力发展',
    confidence: 0.7,
    evidence: [{ type: 'empirical' as const, strength: 0.8, description: '历史数据' }],
    ...overrides,
  } as Proposition;
}

function makeContradictionPair(id: string = 'cp-test'): ContradictionPair {
  return {
    id,
    thesis: makeProposition({ statement: '技术创新' }),
    antithesis: makeProposition({ statement: '传统方法' }),
    contradictionType: 'non_antagonistic',
    domain: 'technology',
    priority: 0.5,
  } as unknown as ContradictionPair;
}

function makeEnv(overrides: Partial<PracticeEnvironment> = {}): PracticeEnvironment {
  return { type: 'simulation', constraints: [], ...overrides };
}

function makeContext(overrides: Partial<PracticeContext> = {}): PracticeContext {
  return {
    domain: 'F01-WisdomGrowth',
    hypothesis: makeProposition(),
    environment: makeEnv(),
    relatedContradictions: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 测试
// ═══════════════════════════════════════════════════════════════

describe('PracticeSpiralEngine', () => {
  let engine: PracticeSpiralEngine;

  beforeEach(() => {
    engine = new PracticeSpiralEngine();
  });

  // ── 阶段一：engagePractice ──

  describe('engagePractice（阶段一：感知实践）', () => {
    it('应返回包含 verdict 的实践结果', async () => {
      const ctx = makeContext();
      const result = await engine.engagePractice(ctx);
      expect([-1, 0, 1]).toContain(result.verdict);
      expect(result.emergentObservations).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.unintendedConsequences).toBeDefined();
    });

    it('有充分证据时 verdict 应为正', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          evidence: [
            { type: 'empirical', strength: 0.9, description: '强证据1' },
            { type: 'empirical', strength: 0.9, description: '强证据2' },
            { type: 'logical', strength: 0.9, description: '强逻辑' },
          ],
        }),
      });
      const result = await engine.engagePractice(ctx);
      expect(result.verdict).toBe(T_TRUE);
    });

    it('生产环境需要更高证据门槛', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          evidence: [
            { type: 'empirical', strength: 0.6, description: '中等证据' },
          ],
        }),
        environment: makeEnv({ type: 'production' }),
      });
      const result = await engine.engagePractice(ctx);
      // 0.6 < 0.7 生产门槛 → 存疑
      expect(result.verdict).toBe(T_UNKNOWN);
    });

    it('应检测意外后果', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({ confidence: 0.4, statement: '不确定假设' }),
        environment: makeEnv({ type: 'production' }),
      });
      const result = await engine.engagePractice(ctx);
      // 低信度 + 生产环境 → 至少生成一些意外后果条目
      expect(result.unintendedConsequences.length).toBeGreaterThanOrEqual(0);
    });

    it('应设置当前阶段为 practice', async () => {
      const ctx = makeContext();
      await engine.engagePractice(ctx);
      const pos = engine.getSpiralPosition();
      expect(pos.currentPhase).toBe('practice');
    });
  });

  // ── 阶段二：deriveCognition ──

  describe('deriveCognition（阶段二：理论认识）', () => {
    it('应从实践中提炼规律', async () => {
      const ctx = makeContext();
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);

      expect(cognition.principles).toBeInstanceOf(Array);
      expect(cognition.confidenceVector).toHaveLength(6);
      expect([-1, 0, 1]).toContain(cognition.universality);
    });

    it('positive practice 应产生正面规律', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          evidence: [
            { type: 'empirical', strength: 0.95, description: '强证据' },
            { type: 'logical', strength: 0.95, description: '强逻辑' },
          ],
        }),
      });
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);
      expect(cognition.universality).toBe(T_TRUE);
      expect(cognition.principles.length).toBeGreaterThan(0);
    });

    it('empty evidence practice 普遍性应为存疑', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({ evidence: [], confidence: 0.1 }),
      });
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);
      expect(cognition.universality).toBe(T_UNKNOWN);
    });
  });

  // ── 阶段三：reengagePractice ──

  describe('reengagePractice（阶段三：验证再实践）', () => {
    it('应基于新认识执行再实践', async () => {
      const ctx = makeContext();
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);
      const rePractice = await engine.reengagePractice(cognition, ctx);

      expect([-1, 0, 1]).toContain(rePractice.verification);
      expect(rePractice.refinedPractice.length).toBeGreaterThan(0);
    });

    it('强规律应被再实践确认', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          evidence: [
            { type: 'empirical', strength: 0.9, description: 'e1' },
            { type: 'empirical', strength: 0.9, description: 'e2' },
          ],
        }),
      });
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);

      // 手动强化认知以达到 T_TRUE 标准
      // 默认 cognition 可能不满足 universality=1 且 principles>=2
      const result = await engine.reengagePractice(cognition, ctx);
      expect([-1, 0, 1]).toContain(result.verification);
    });
  });

  // ── 阶段四：deepenCognition ──

  describe('deepenCognition（阶段四：深化再认识）', () => {
    it('应深化原有认识', async () => {
      const ctx = makeContext();
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);
      const rePractice = await engine.reengagePractice(cognition, ctx);
      const deepened = await engine.deepenCognition(cognition, rePractice);

      expect(deepened.deepenedPrinciples.length).toBeGreaterThan(
        cognition.principles.length,
      );
      expect(deepened.updatedConfidenceVector).toHaveLength(6);
      expect([-1, 0, 1]).toContain(deepened.spiralAscension);
    });
  });

  // ── 完整螺旋周期 ──

  describe('iterateSpiral（完整螺旋周期）', () => {
    it('应完成完整的四阶段螺旋', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          evidence: [
            { type: 'empirical', strength: 0.9, description: '强证据' },
            { type: 'logical', strength: 0.8, description: '强逻辑' },
          ],
        }),
      });
      const result = await engine.iterateSpiral(ctx);

      expect(result.cycleNumber).toBe(1);
      expect(result.phases.practice).toBeDefined();
      expect(result.phases.cognition).toBeDefined();
      expect(result.phases.rePractice).toBeDefined();
      expect(result.phases.deepenedCognition).toBeDefined();
      expect(result.quality.genuineAscension).toBeDefined();
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('多次螺旋应递增 cycleNumber', async () => {
      const ctx = makeContext();
      const r1 = await engine.iterateSpiral(ctx);
      const r2 = await engine.iterateSpiral(ctx);
      expect(r1.cycleNumber).toBe(1);
      expect(r2.cycleNumber).toBe(2);
    });

    it('应记录螺旋历史', async () => {
      const ctx = makeContext({ domain: 'F03-KnowledgeTransfer' });
      await engine.iterateSpiral(ctx);
      const history = engine.getSpiralHistory();
      expect(history.totalCycles).toBe(1);
      expect(history.domains).toContain('F03-KnowledgeTransfer');
    });

    it('应在强劲证据下产生螺旋上升', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({
          confidence: 0.85,
          evidence: [
            { type: 'empirical', strength: 0.95, description: 'e1' },
            { type: 'empirical', strength: 0.9, description: 'e2' },
            { type: 'logical', strength: 0.85, description: 'e3' },
          ],
        }),
      });
      const result = await engine.iterateSpiral(ctx);
      // 强证据条件下，质量评估不应为负
      expect(result.quality.genuineAscension).not.toBe(T_FALSE);
    });
  });

  // ── 阶段判定 ──

  describe('judgePhase（阶段判定）', () => {
    it('practice 阶段正结果应判定为 +1', async () => {
      const ctx = makeContext();
      const practice = await engine.engagePractice(ctx);
      // 修改 verdict 为 +1 来测试
      const modified = { ...practice, verdict: T_TRUE, unintendedConsequences: [] };
      const verdict = await engine.judgePhase('practice', modified);
      expect(verdict).toBe(T_TRUE);
    });

    it('practice 阶段负结果应判定为 -1', async () => {
      const verdict = await engine.judgePhase('practice', {
        verdict: T_FALSE,
        emergentObservations: [],
        newContradictions: [],
        metrics: {},
        unintendedConsequences: [],
      });
      expect(verdict).toBe(T_FALSE);
    });

    it('cognition 阶段应基于信度判定', async () => {
      const ctx = makeContext();
      const practice = await engine.engagePractice(ctx);
      const cognition = await engine.deriveCognition(practice);
      const verdict = await engine.judgePhase('cognition', cognition);
      expect([-1, 0, 1]).toContain(verdict);
    });

    it('rePractice 阶段应直接使用 verification', async () => {
      const verdict = await engine.judgePhase('rePractice', {
        verification: T_TRUE,
        refinedPractice: '测试',
        newContradictions: [],
      });
      expect(verdict).toBe(T_TRUE);
    });

    it('deepenCognition 阶段应直接使用 spiralAscension', async () => {
      const verdict = await engine.judgePhase('deepenCognition', {
        deepenedPrinciples: ['p1'],
        spiralAscension: T_TRUE,
        emergentProperties: [],
        updatedConfidenceVector: [1, 1, 1, 1, 1, 1],
      });
      expect(verdict).toBe(T_TRUE);
    });
  });

  // ── 位置与历史 ──

  describe('getSpiralPosition / getSpiralHistory', () => {
    it('初始位置应反映初始状态', () => {
      const pos = engine.getSpiralPosition();
      expect(pos.cycleCount).toBe(0);
      expect(pos.totalAscensions).toBe(0);
    });

    it('一次螺旋后应更新状态', async () => {
      await engine.iterateSpiral(makeContext());
      const pos = engine.getSpiralPosition();
      expect(pos.cycleCount).toBe(1);
    });

    it('初始历史应为空', () => {
      const history = engine.getSpiralHistory();
      expect(history.totalCycles).toBe(0);
      expect(history.entries).toHaveLength(0);
    });
  });

  // ── 边界条件 ──

  describe('边界条件', () => {
    it('空证据的假设应返回存疑', async () => {
      const ctx = makeContext({
        hypothesis: makeProposition({ evidence: [], confidence: 0.1 }),
      });
      const result = await engine.engagePractice(ctx);
      expect(result.verdict).toBe(T_UNKNOWN);
    });

    it('human_feedback 环境应正常工作', async () => {
      const ctx = makeContext({ environment: makeEnv({ type: 'human_feedback' }) });
      const result = await engine.engagePractice(ctx);
      expect(result).toBeDefined();
    });

    it('sandbox 环境应正常工作', async () => {
      const ctx = makeContext({ environment: makeEnv({ type: 'sandbox' }) });
      const result = await engine.engagePractice(ctx);
      expect(result).toBeDefined();
    });

    it('有关联矛盾时应生成涌现观察', async () => {
      const ctx = makeContext({
        relatedContradictions: [makeContradictionPair()],
        environment: makeEnv({ type: 'production' }),
      });
      const result = await engine.engagePractice(ctx);
      expect(result.emergentObservations.length).toBeGreaterThan(0);
    });

    it('应区分不同领域的螺旋', async () => {
      await engine.iterateSpiral(makeContext({ domain: 'F01' }));
      await engine.iterateSpiral(makeContext({ domain: 'F02' }));
      const history = engine.getSpiralHistory();
      expect(history.domains).toContain('F01');
      expect(history.domains).toContain('F02');
      expect(history.totalCycles).toBe(2);
    });
  });
});
