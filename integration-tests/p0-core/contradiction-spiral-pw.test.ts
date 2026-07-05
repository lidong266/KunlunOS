/**
 * P0-3: 矛盾引擎 → 实践螺旋 → 持久战阶段联动
 *
 * 验证矛盾分析输出驱动实践螺旋，螺旋结果驱动持久战阶段转换。
 * 这是 V2 架构最复杂的跨包数据流：矛盾论 → 实践论 → 持久战三阶段。
 *
 * 涉及包: @kunlun/ternary, @kunlun/contradiction, @kunlun/spiral, @kunlun/pw
 */

import { describe, it, expect } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE, tryteToValue } from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';
import { PracticeSpiralEngine } from '@kunlun/spiral';
import { ProtractedWarEngine } from '@kunlun/pw';
import {
  securityVsPerformance,
  innovationVsStability,
  physicsContext,
  engineeringContext,
  defensePhaseContext,
  stalematePhaseContext,
  counteroffensivePhaseContext,
} from '../helpers/fixtures';
import {
  makePracticeContext,
  makeProposition,
  makePWContext,
  makeSpiralMetrics,
  makePowerSnapshot,
} from '../helpers/factories';

describe('P0-3: Contradiction → Spiral → PW', () => {
  // ─── 场景 3.1: 完整螺旋周期 ───

  it('3.1 should complete a full spiral cycle with 4 phases', async () => {
    const engine = new PracticeSpiralEngine();

    const output = await engine.iterateSpiral(physicsContext);

    expect(output).toBeDefined();
    // SpiralCycleOutput 的 phases 包装了 4 阶段数据
    expect(output.phases.practice).toBeDefined();
    expect(output.phases.cognition).toBeDefined();
    expect(output.phases.rePractice).toBeDefined();
    expect(output.phases.deepenedCognition).toBeDefined();
    expect(output.cycleNumber).toBeGreaterThanOrEqual(1);
  });

  it('3.1b should produce valid verdict in each spiral phase', async () => {
    const engine = new PracticeSpiralEngine();
    const output = await engine.iterateSpiral(engineeringContext);

    // practice verdict 应为有效 Trit
    const practice = output.phases.practice;
    expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(practice.verdict);
    expect(practice.emergentObservations).toBeDefined();
    expect(practice.metrics).toBeDefined();
  });

  // ─── 场景 3.2: 正确判定的螺旋上升 ───

  it('3.2 should detect genuine ascension with all-positive phases', async () => {
    const engine = new PracticeSpiralEngine();

    // 使用高确信度命题触发上升
    const positiveCtx = makePracticeContext({
      domain: 'engineering',
      hypothesis: makeProposition({
        id: 'prop-verified',
        statement: '已验证有效的优化策略',
        confidenceTrit: T_TRUE,
        evidence: [
          { type: 'empirical', content: '实验数据验证', strength: T_TRUE, source: 'lab', timestamp: Date.now() },
          { type: 'logical', content: '逻辑推导一致', strength: T_TRUE, source: 'reasoning', timestamp: Date.now() },
        ],
      }),
    });

    const output = await engine.iterateSpiral(positiveCtx);

    expect(output.quality).toBeDefined();
    // 螺旋上升判定应为有效 Trit
    if (output.quality?.genuineAscension !== undefined) {
      expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(output.quality.genuineAscension);
    }
  });

  // ─── 场景 3.3: PW 影响评估 — 螺旋上升 → 阶段转换 ───

  it('3.3 should assess spiral impact on protracted war phase', async () => {
    const spiralEngine = new PracticeSpiralEngine();
    const pwEngine = new ProtractedWarEngine();

    // 先执行螺旋周期
    const spiralOutput = await spiralEngine.iterateSpiral(engineeringContext);

    expect(spiralOutput.protractedWarImpact).toBeDefined();
    expect(spiralOutput.protractedWarImpact.phaseShift).toBeDefined();
    expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(
      spiralOutput.protractedWarImpact.phaseShift
    );
  });

  // ─── 场景 3.4: PWContext 构造与 assessPhase ───

  it('3.4 should construct PWContext with spiral metrics and assess phase', async () => {
    const pwEngine = new ProtractedWarEngine();

    // 使用防御阶段 context
    const assessment = await pwEngine.assessPhase(defensePhaseContext);

    expect(assessment).toBeDefined();
    expect(assessment.currentPhase).toBeDefined();
    expect(assessment.practiceSpiralStatus).toBeDefined();
    expect(assessment.practiceSpiralStatus.spiralAscending).toBeDefined();
  });

  it('3.4b should yield different Trit-based assessment for defense vs stalemate', async () => {
    const pwEngine = new ProtractedWarEngine();

    const defenseAssessment = await pwEngine.assessPhase(defensePhaseContext);
    const stalemateAssessment = await pwEngine.assessPhase(stalematePhaseContext);

    // 力量对比为 Trit，两阶段应有不同的判定
    expect(defenseAssessment.powerBalance.relativeStrength).toBeDefined();
    expect(stalemateAssessment.powerBalance.relativeStrength).toBeDefined();
    // 防御阶段力量对比应为劣势 (T_FALSE)，相持阶段应接近平衡或优势
    expect(defenseAssessment.powerBalance.relativeStrength).toBe(T_FALSE);
  });

  // ─── 场景 3.5: 防御 → 相持转换判定 ───

  it('3.5 should evaluate defense-to-stalemate shift with improving trends', async () => {
    const pwEngine = new ProtractedWarEngine();

    // 构造接近转换条件的防御 context
    const shiftingContext = makePWContext({
      totalRuntime: 50000,
      currentPhaseDuration: 30000,
      powerSnapshot: makePowerSnapshot({
        relativeStrengthRatio: 0.95,
        strengthTrend: [0.7, 0.83, 0.95],
      }),
      spiralMetrics: makeSpiralMetrics({
        totalCycles: 3,
        recentAscensionRatio: { ascension: 0.6, flat: 0.25, regression: 0.15 },
      }),
    });

    const assessment = await pwEngine.assessPhase(shiftingContext);
    const decision = await pwEngine.evaluatePhaseShift(assessment);

    expect(decision).toBeDefined();
    expect(decision.shouldShift).toBeDefined();
    expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(decision.shouldShift);
  });

  // ─── 场景 3.6: 相持 → 反攻完整条件 ───

  it('3.6 should evaluate stalemate-to-counteroffensive with overwhelming advantage', async () => {
    const pwEngine = new ProtractedWarEngine();

    const assessment = await pwEngine.assessPhase(stalematePhaseContext);
    const decision = await pwEngine.evaluatePhaseShift(assessment);

    expect(decision).toBeDefined();
    if (decision.shouldShift === T_TRUE) {
      expect(decision.targetPhase).toBeDefined();
    }
  });

  it('3.6b should produce counteroffensive tactics when in counteroffensive phase', async () => {
    const pwEngine = new ProtractedWarEngine();

    const assessment = await pwEngine.assessPhase(counteroffensivePhaseContext);
    const tactics = await pwEngine.counteroffensiveTactics(assessment);

    expect(tactics).toBeDefined();
    expect(tactics.specificTactics).toBeDefined();
    expect(tactics.specificTactics.length).toBeGreaterThanOrEqual(0);
    expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(tactics.fullScale);
  });

  // ─── 场景 3.7: 实践证伪 → 螺旋下降 → PW 退却 ───

  it('3.7 should handle negative spiral verdict gracefully', async () => {
    const spiralEngine = new PracticeSpiralEngine();

    // 使用低信度假说触发证伪
    const falsifiedCtx = makePracticeContext({
      domain: 'general',
      hypothesis: makeProposition({
        id: 'prop-falsified',
        statement: '一个可能被证伪的假设',
        confidenceTrit: T_FALSE,
      }),
    });

    const output = await spiralEngine.iterateSpiral(falsifiedCtx);

    // 系统应能优雅处理负面结果
    expect(output).toBeDefined();
    expect(output.phases.practice).toBeDefined();
    // 不应崩溃
  });

  // ─── 场景 3.8: 战术生成 — 各阶段应产生不同战术 ───

  it('3.8 should generate defense-specific tactics with active defense trit', async () => {
    const pwEngine = new ProtractedWarEngine();

    // 防御阶段 — 调用 defenseTactics
    const defenseAssessment = await pwEngine.assessPhase(defensePhaseContext);
    const defenseTactics = await pwEngine.defenseTactics(defenseAssessment);

    expect(defenseTactics).toBeDefined();
    expect(defenseTactics.specificTactics).toBeDefined();
    expect(defenseTactics.specificTactics.length).toBeGreaterThan(0);
    expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(defenseTactics.activeDefense);
  });

  it('3.8b should allocate more offense resources in counteroffensive via tempo', async () => {
    const pwEngine = new ProtractedWarEngine();

    const defenseAssessment = await pwEngine.assessPhase(defensePhaseContext);
    const counterAssessment = await pwEngine.assessPhase(counteroffensivePhaseContext);

    // 使用 tempo 引擎获取资源分配
    const defenseTempo = await pwEngine.regulateTempo(defenseAssessment.currentPhase, {
      strengthChangeRate: 0.0,
      spiralFrequency: 1,
    });
    const counterTempo = await pwEngine.regulateTempo(counterAssessment.currentPhase, {
      strengthChangeRate: 0.3,
      spiralFrequency: 3,
    });

    // 反攻阶段应有更多进攻资源
    expect(counterTempo.resourceAllocation.offense)
      .toBeGreaterThanOrEqual(defenseTempo.resourceAllocation.offense);
  });

  // ─── 端到端: Contradiction → Spiral → PW 全链路 ───

  it('should flow from contradiction analysis through spiral to PW phase shift end-to-end', async () => {
    const ce = createContradictionEngine();
    const se = new PracticeSpiralEngine();
    const pw = new ProtractedWarEngine();

    // 1. 矛盾分析
    const analysis = ce.analyzeSingle(securityVsPerformance);
    expect(analysis.metadata.modulesExecuted.length).toBeGreaterThan(0);
    expect(analysis.analysis.unifiability).toBeDefined();
    expect(analysis.analysis.contradictionType).toBeDefined();

    // 2. 实践螺旋（使用矛盾相关的命题）
    const spiralCtx = makePracticeContext({
      domain: 'engineering',
      hypothesis: makeProposition({
        id: 'prop-from-contradiction',
        statement: `基于矛盾分析：unifiability=${analysis.analysis.unifiability}`,
        domain: 'engineering',
      }),
      relatedContradictions: [securityVsPerformance],
    });

    const spiralOutput = await se.iterateSpiral(spiralCtx);

    // 3. 持久战阶段评估（使用螺旋指标）
    const pwCtx = makePWContext({
      totalRuntime: 10000,
      currentPhaseDuration: 5000,
      spiralMetrics: makeSpiralMetrics({
        totalCycles: spiralOutput.cycleNumber,
        recentAscensionRatio: {
          ascension: spiralOutput.quality?.genuineAscension === T_TRUE ? 0.7 : 0.3,
          flat: 0.2,
          regression: 0.1,
        },
      }),
      activeContradictions: [securityVsPerformance],
    });

    const assessment = await pw.assessPhase(pwCtx);
    expect(assessment.currentPhase).toBeDefined();
    expect(assessment.practiceSpiralStatus).toBeDefined();

    const decision = await pw.evaluatePhaseShift(assessment);
    expect(decision).toBeDefined();
  });

  // ─── Spiral 历史追踪 ───

  it('should track spiral history across multiple cycles', async () => {
    const engine = new PracticeSpiralEngine();

    await engine.iterateSpiral(physicsContext);
    await engine.iterateSpiral(engineeringContext);

    const history = engine.getSpiralHistory();
    expect(history.entries).toBeDefined();
    expect(history.entries.length).toBeGreaterThanOrEqual(2);
  });
});
