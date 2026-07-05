/**
 * P0-2: 谛听感知 → 矛盾引擎 → 太一执行链
 *
 * 验证 Diting 的矛盾对检测 → ContradictionEngine 8分析器管线 →
 * Taiyi 的学科路由和辩论裁决端到端流程。
 */
import { describe, it, expect } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE, valueToTryte } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';
import {
  ContradictionSignalDetector,
  SignalSource,
  SIGNAL_RELIABILITY_INIT,
  ContradictionExecutor,
  DomainRouter,
  tryteToTrits,
} from '@kunlun/subsystems';

// Helper: build a minimal Proposition for the contradiction engine
function makeProp(statement: string, confidenceTrit: Trit = T_TRUE) {
  const now = Date.now();
  return {
    id: `prop-${Math.random().toString(36).slice(2, 8)}`,
    statement,
    domain: 'test',
    evidence: [] as { type: string; content: string; strength: Trit; source: string; timestamp: number }[],
    counterEvidence: [] as { type: string; content: string; strength: Trit; source: string; timestamp: number }[],
    confidenceTrit,
    confidenceVector: valueToTryte(0),
    source: { type: 'human' as const, identifier: 'test' },
    dependencies: [] as string[],
    createdAt: now,
    updatedAt: now,
  };
}

describe('P0-2: Diting → Contradiction → Taiyi', () => {
  // ── Scenario 2.1 ──
  describe('Scenario 2.1: Signal reliability initialization', () => {
    it('HUMAN_INPUT signal reliability has valid Trit values', () => {
      const humanReliability = SIGNAL_RELIABILITY_INIT.human_input;
      expect(humanReliability).toBeDefined();
      const trits = tryteToTrits(humanReliability);
      expect(trits).toHaveLength(6);
    });

    it('all signal reliability entries have 6 dimensions', () => {
      for (const [, reliability] of Object.entries(SIGNAL_RELIABILITY_INIT)) {
        const trits = tryteToTrits(reliability);
        expect(trits).toHaveLength(6);
        for (const trit of trits) {
          expect([-1, 0, 1]).toContain(trit);
        }
      }
    });
  });

  // ── Scenario 2.2 ──
  describe('Scenario 2.2: Diting detects contradiction pairs', () => {
    it('should perceive signal and extract contradictions from text with antonyms', () => {
      const detector = new ContradictionSignalDetector();
      const result = detector.perceiveSignal(
        '量子力学认为确定性不存在，但是相对论坚持确定性是宇宙的基本法则',
        SignalSource.HUMAN_INPUT,
      );
      expect(result).toBeDefined();
      expect(result.rawSignal).toBeDefined();
      expect(result.signalTrits).toBeDefined();
      expect(Array.isArray(result.signalTrits)).toBe(true);
    });

    it('should extract contradictions from text containing opposing markers', () => {
      const detector = new ContradictionSignalDetector();
      const perception = detector.perceiveSignal(
        '唯物辩证法强调矛盾的对立统一，然而形而上学只看到对立看不到统一',
        SignalSource.HUMAN_INPUT,
      );
      expect(perception.contradictions).toBeDefined();
      expect(Array.isArray(perception.contradictions)).toBe(true);
    });

    it('should return empty array for text without opposing markers', () => {
      const detector = new ContradictionSignalDetector();
      const perception = detector.perceiveSignal(
        '今天天气很好，适合出门散步',
        SignalSource.HUMAN_INPUT,
      );
      expect(Array.isArray(perception.contradictions)).toBe(true);
      expect(perception.contradictions.length).toBe(0);
    });
  });

  // ── Scenario 2.3 ──
  describe('Scenario 2.3: Full 8-analyzer pipeline', () => {
    it('should run all enabled analyzers on a contradiction pair', () => {
      const engine = createContradictionEngine();
      const output = engine.analyzeSingle({
        id: 'cp-test-1',
        thesis: makeProp('人工智能将取代人类劳动', T_TRUE),
        antithesis: makeProp('人工智能将创造更多新工作', T_TRUE),
        contradictionType: 'non_antagonistic',
        priority: 1,
        discoveredAt: Date.now(),
        warPhaseAtDiscovery: 'strategic_defense',
        relatedContradictions: [],
      });
      expect(output).toBeDefined();
      expect(output.contradictionId).toBe('cp-test-1');
      expect(output.analysis).toBeDefined();
      expect(typeof output.analysis.unifiability).toBe('number');
      expect(output.metadata.modulesExecuted.length).toBeGreaterThanOrEqual(6);
      expect(output.metadata.engineVersion).toBeDefined();
    });

    it('should produce valid overall confidence Trit', () => {
      const engine = createContradictionEngine();
      const output = engine.analyzeSingle({
        id: 'cp-test-2',
        thesis: makeProp('市场是有效的', T_TRUE),
        antithesis: makeProp('市场存在系统性非理性', T_FALSE),
        contradictionType: 'antagonistic',
        priority: 2,
        discoveredAt: Date.now(),
        warPhaseAtDiscovery: 'strategic_defense',
        relatedContradictions: [],
      });
      expect([-1, 0, 1]).toContain(output.overallConfidence);
      expect(output.confidenceVector).toHaveLength(6);
    });
  });

  // ── Scenario 2.4 ──
  describe('Scenario 2.4: Synthesize unifiability', () => {
    it('should compute unifiability for thesis=antithesis=T_TRUE pair', () => {
      const engine = createContradictionEngine();
      const output = engine.analyzeSingle({
        id: 'unified-test',
        thesis: makeProp('A and B are the same concept', T_TRUE),
        antithesis: makeProp('A and B are the same concept', T_TRUE),
        contradictionType: 'non_antagonistic',
        priority: 1,
        discoveredAt: Date.now(),
        warPhaseAtDiscovery: 'strategic_defense',
        relatedContradictions: [],
      });
      expect([-1, 0, 1]).toContain(output.analysis.unifiability);
    });
  });

  // ── Scenario 2.5 ──
  describe('Scenario 2.5: DomainRouter routes by discipline', () => {
    it('should route physics keywords', () => {
      const router = new DomainRouter();
      const domain = router.route('量子力学与相对论的统一');
      expect(domain).toBeDefined();
      expect(typeof domain).toBe('string');
    });

    it('should route philosophy keywords', () => {
      const router = new DomainRouter();
      const domain = router.route('唯物主义与唯心主义的辩证关系');
      expect(domain).toBeDefined();
    });
  });

  // ── Scenario 2.6 ──
  describe('Scenario 2.6: DebateEngine 3-round debate', () => {
    it('should produce debate rounds with a Trit verdict', () => {
      const executor = new ContradictionExecutor();
      const task = executor.submitTask({
        thesis: '自由意志存在',
        antithesis: '一切都是决定论的',
      });
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.status).toBe('pending');

      const result = executor.executeTask(task.id);
      expect(result).toBeDefined();
      expect(result!.verdict).toBeDefined();
      expect([-1, 0, 1]).toContain(result!.verdict);
      expect(result!.rounds).toBeDefined();
      expect(result!.rounds.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Scenario 2.7 ──
  describe('Scenario 2.7: ContradictionExecutor task lifecycle', () => {
    it('should transition task from pending → running → completed', () => {
      const executor = new ContradictionExecutor();
      const task = executor.submitTask({
        thesis: '技术决定论',
        antithesis: '社会建构论',
      });
      expect(task.status).toBe('pending');

      const result = executor.executeTask(task.id);
      expect(result).toBeDefined();
      expect(result!.verdict).toBeDefined();

      const tasks = executor.getAllTasks();
      const executed = tasks.find(t => t.id === task.id);
      expect(executed).toBeDefined();
      expect(executed!.status).toBe('completed');
    });
  });

  // ── Multi-contradiction ──
  describe('Multi-contradiction analysis', () => {
    it('should analyze multiple contradiction pairs', () => {
      const engine = createContradictionEngine();
      const results = engine.analyzeMultiple([
        {
          id: 'mcp-1',
          thesis: makeProp('集中式架构更高效', T_TRUE),
          antithesis: makeProp('分布式架构更灵活', T_TRUE),
          contradictionType: 'non_antagonistic',
          priority: 1,
          discoveredAt: Date.now(),
          warPhaseAtDiscovery: 'strategic_defense',
          relatedContradictions: [],
        },
        {
          id: 'mcp-2',
          thesis: makeProp('静态类型更安全', T_TRUE),
          antithesis: makeProp('动态类型更高效', T_UNKNOWN),
          contradictionType: 'non_antagonistic',
          priority: 2,
          discoveredAt: Date.now(),
          warPhaseAtDiscovery: 'strategic_defense',
          relatedContradictions: [],
        },
      ]);
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.metadata.modulesExecuted.length).toBeGreaterThanOrEqual(6);
      }
    });
  });
});
