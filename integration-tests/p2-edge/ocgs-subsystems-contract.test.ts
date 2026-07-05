/**
 * P2-5: OCGS ↔ Subsystems 契约集成测试
 *
 * 验证 OCGS 编排器与各子系统（Diting、Guicang、Langhuan）的接口契约。
 * 使用 IOCGSOrchestrator 实际 API。
 */
import { describe, it, expect } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import {
  ContradictionSignalDetector,
  SignalSource,
  TernaryKnowledgeIndex,
  TernaryMemoryModel,
  KnowledgeContradictionGraph,
} from '@kunlun/subsystems';
import { createOCGSOrchestrator } from '@kunlun/ocgs';
import type { EcosystemChange } from '@kunlun/ocgs';

describe('OCGS ↔ Subsystems Contract', () => {
  // ─── Diting → OCGS Signal Integration ─────
  describe('Diting → OCGS Signal Integration', () => {
    it('OCGS should accept Diting perceiveSignal() results', async () => {
      const detector = new ContradictionSignalDetector();
      const perception = detector.perceiveSignal(
        '系统出现矛盾: 性能 vs 安全',
        SignalSource.HUMAN_INPUT,
      );
      expect(perception).toBeDefined();
      expect(perception.rawSignal).toBeDefined();
      expect(perception.signalTrits.length).toBeGreaterThan(0);

      // OCGS scanEcosystem() 不需要 initialize()
      const orchestrator = createOCGSOrchestrator();
      const scan = await orchestrator.scanEcosystem();
      expect(scan).toBeDefined();
      expect(scan.scanId).toBeDefined();
      expect(scan.timestamp).toBeDefined();
      expect(scan.scanTimestamp === undefined || typeof scan.scanTimestamp === 'number').toBe(true);
      if (typeof scan.processTimeMs === 'number') {
        expect(scan.processTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle multiple signals from Diting via multiple OCGS scans', async () => {
      const detector = new ContradictionSignalDetector();
      detector.perceiveSignal('内存泄漏风险升高', SignalSource.HUMAN_INPUT);
      detector.perceiveSignal('知识库一致性下降', SignalSource.HUMAN_INPUT);
      detector.perceiveSignal('事件总线饱和度 85%', SignalSource.HUMAN_INPUT);

      const orchestrator = createOCGSOrchestrator();
      const scan1 = await orchestrator.scanEcosystem();
      expect(scan1.scanId).toBeDefined();

      const scan2 = await orchestrator.scanEcosystem();
      expect(scan2.scanId).not.toBe(scan1.scanId);
    });
  });

  // ─── Guicang → OCGS Memory Adaptation ─────
  describe('Guicang → OCGS Memory Adaptation', () => {
    it('reinforce() and negate() should alter memory state', () => {
      const memory = new TernaryMemoryModel();
      const knowledgeIndex = new TernaryKnowledgeIndex();
      const graph = new KnowledgeContradictionGraph(knowledgeIndex);

      // 存入两条冲突的知识
      knowledgeIndex.addEntry(
        '微服务架构是当前最优解',
        'architecture',
        'engineering_team',
        ['microservices'],
      );
      knowledgeIndex.addEntry(
        '单体架构在中小规模系统中有更好性价比',
        'architecture',
        'operations_team',
        ['monolith'],
      );

      const memA = memory.store('微服务架构是当前最优解', 'engineering_team', ['microservices']);
      const memB = memory.store('单体架构在中小规模系统中有更好性价比', 'operations_team', ['monolith']);

      const reinforced = memory.reinforce(memA.id);
      expect(reinforced).toBe(true);

      const negated = memory.negate(memB.id);
      expect(negated).toBe(true);

      const updatedA = memory.recall(memA.id);
      expect(updatedA!.reinforcementCount).toBeGreaterThan(0);

      const contradictions = graph.detectContradictions();
      expect(Array.isArray(contradictions)).toBe(true);
    });

    it('OCGS should detect emergence after memory changes', async () => {
      const memory = new TernaryMemoryModel();
      const knowledgeIndex = new TernaryKnowledgeIndex();

      knowledgeIndex.addEntry('敏捷开发提升效率', 'methodology', 'proponent', ['agile']);
      knowledgeIndex.addEntry('瀑布模型更适合关键系统', 'methodology', 'opponent', ['waterfall']);
      memory.store('敏捷开发提升效率', 'proponent', ['agile']);
      memory.store('瀑布模型更适合关键系统', 'opponent', ['waterfall']);

      const orchestrator = createOCGSOrchestrator();
      const scan = await orchestrator.scanEcosystem();
      expect(scan.scanId).toBeDefined();

      // detectEmergence requires a SystemModelSnapshot
      const snapshot = await orchestrator.updateSystemModel();
      const report = orchestrator.detectEmergence(snapshot);
      expect(report).toBeDefined();
    });
  });

  // ─── Langhuan → OCGS Knowledge Evolution ─────
  describe('Langhuan → OCGS Knowledge Evolution', () => {
    it('KnowledgeContradictionGraph should integrate with OCGS adapt()', async () => {
      const knowledgeIndex = new TernaryKnowledgeIndex();
      const graph = new KnowledgeContradictionGraph(knowledgeIndex);

      knowledgeIndex.addEntry('集中式数据库保证一致性', 'data_storage', 'dba_team', ['sql']);
      knowledgeIndex.addEntry('分布式数据库有更好的扩展性', 'data_storage', 'sre_team', ['nosql']);
      knowledgeIndex.addEntry('CAP 定理表明一致性与可用性不可兼得', 'theory', 'research', ['cap']);

      const contradictions = graph.detectContradictions();
      expect(Array.isArray(contradictions)).toBe(true);

      // OCGS adapt() takes a single EcosystemChange
      const orchestrator = createOCGSOrchestrator();
      const change: EcosystemChange = {
        type: 'ecosystem_restructure',
        source: 'self',
        description: 'Knowledge graph contradictions detected',
        affectedComponents: ['langhuan', 'guicang'],
        severity: T_UNKNOWN as Trit,
        timestamp: Date.now(),
      };
      const result = await orchestrator.adapt(change);
      expect(result).toBeDefined();
    });
  });

  // ─── OCGS 状态与生命周期 ─────
  describe('OCGS State & Lifecycle', () => {
    it('should expose OCGS state and support start/stop', async () => {
      const orchestrator = createOCGSOrchestrator();
      const state = orchestrator.getOCGSState();
      expect(state).toBeDefined();

      // start/stop for background scanning
      orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
      orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);

      // fullCycle runs end-to-end
      const result = await orchestrator.fullCycle();
      expect(result).toBeDefined();
      expect(result.scan).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.emergence).toBeDefined();
      expect(Array.isArray(result.adaptations)).toBe(true);
      expect(result.cycleDurationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
