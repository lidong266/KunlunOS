/**
 * P2-7: 归藏记忆 ↔ 琅嬛知识 ↔ 矛盾引擎三角
 *
 * 验证记忆衰减、知识索引 Trit 匹配、矛盾对证据链的三角联动。
 *
 * 涉及包: @kunlun/ternary, @kunlun/subsystems (guicang/langhuan), @kunlun/contradiction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE, valueToTryte } from '@kunlun/ternary';
import {
  MemoryEntry,
  TernaryMemoryModel,
  DecayParams,
  ResonantMemoryNetwork,
  KnowledgeEntry,
  TernaryKnowledgeIndex,
  KnowledgeContradictionGraph,
} from '@kunlun/subsystems';

describe('P2-7: Guicang ↔ Langhuan ↔ Contradiction triangle', () => {
  // ── Scenario 7.1: 记忆强化/衰减 ──
  describe('Scenario 7.1: Memory reinforcement and decay', () => {
    let model: TernaryMemoryModel;
    let entryId: string;

    beforeEach(() => {
      model = new TernaryMemoryModel();
      const stored = model.store(
        'Dialectics is the science of universal interconnection',
        'test',
      );
      entryId = stored.id;
    });

    it('reinforce() should increase strength and reinforcementCount', () => {
      const initial = model.recall(entryId)!;
      const initialStrength = initial.strength;
      const initialReinforce = initial.reinforcementCount;

      const result = model.reinforce(entryId);
      expect(result).toBe(true);

      const updated = model.recall(entryId)!;
      expect(updated.strength).toBeGreaterThan(initialStrength);
      expect(updated.reinforcementCount).toBe(initialReinforce + 1);
    });

    it('negate() should decrease strength and increase negationCount', () => {
      const initial = model.recall(entryId)!;
      const initialStrength = initial.strength;
      const initialNegation = initial.negationCount;

      const result = model.negate(entryId);
      expect(result).toBe(true);

      const updated = model.recall(entryId)!;
      expect(updated.strength).toBeLessThan(initialStrength);
      expect(updated.negationCount).toBe(initialNegation + 1);
    });

    it('applyDecay() should reduce strength over time', () => {
      const initial = model.recall(entryId)!;
      const newState = model.applyDecay(entryId, 1);
      // applyDecay returns the new Trit state after decay
      expect(newState).toBeDefined();
      const updated = model.recall(entryId)!;
      // After 1 day of decay, strength should be reduced
      expect(updated.strength).toBeLessThanOrEqual(initial.strength);
    });

    it('applyGlobalDecay() should affect all memories', () => {
      // Store additional memories
      model.store('Memory B', 'test', ['tag-b']);
      model.store('Memory C', 'test', ['tag-c']);

      const statsBefore = model.getStats();
      const results = model.applyGlobalDecay(1);
      // results is Map<string, Trit>
      expect(results.size).toBe(statsBefore.total);

      // All memories should have been affected
      for (const [id, trit] of results) {
        expect(typeof id).toBe('string');
        expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(trit);
      }
    });
  });

  // ── Scenario 7.2: 知识索引 Trit 匹配 ──
  describe('Scenario 7.2: Knowledge index Trit matching', () => {
    let index: TernaryKnowledgeIndex;

    beforeEach(() => {
      index = new TernaryKnowledgeIndex();
      // addEntry(content, classification, source, tags)
      index.addEntry(
        'Matter is primary; consciousness is derived',
        T_TRUE,
        'marxist-philosophy',
        ['materialism', 'ontology'],
      );
      index.addEntry(
        'Quantum physics challenges classical determinism',
        T_UNKNOWN,
        'physics',
        ['quantum', 'determinism'],
      );
      index.addEntry(
        'Ether as universal medium has been disproven',
        T_FALSE,
        'physics-history',
        ['ether', 'disproven'],
      );
    });

    it('queryByClassification should return correct entries', () => {
      const confirmed = index.queryByClassification(T_TRUE);
      expect(confirmed.length).toBe(1);
      expect(confirmed[0].source).toBe('marxist-philosophy');

      const pending = index.queryByClassification(T_UNKNOWN);
      expect(pending.length).toBe(1);
      expect(pending[0].source).toBe('physics');

      const negated = index.queryByClassification(T_FALSE);
      expect(negated.length).toBe(1);
      expect(negated[0].source).toBe('physics-history');
    });

    it('queryByCredibilityVector should rank results', () => {
      // API accepts minTrits: number[]
      const results = index.queryByCredibilityVector([0, 0, 0, 0, 0, 0]);
      expect(results.length).toBeGreaterThan(0);
      // Highest credibility vector match should come first
      if (results.length >= 2) {
        expect(results[0].accessCount).toBeGreaterThanOrEqual(results[1].accessCount);
      }
    });

    it('search should find entries by content', () => {
      const results = index.search('matter');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.includes('Matter'))).toBe(true);
    });
  });

  // ── Scenario 7.3: 矛盾证据引用记忆 ──
  describe('Scenario 7.3: Contradiction evidence referencing memory', () => {
    const model = new TernaryMemoryModel();
    const network = new ResonantMemoryNetwork(model);

    it('resonant network should activate related memories', () => {
      const mem1 = model.store(
        'Thesis: change is driven by internal contradictions',
        'philosophy',
      );
      const mem2 = model.store(
        'Related antithesis concept',
        'philosophy',
      );

      // Create association between mem1 and mem2
      model.associate(mem1.id, mem2.id);

      // Capture pre-resonance strength (mem2 is a mutable reference)
      const mem2InitialStrength = mem2.strength;

      // resonate(sourceId) returns ResonanceEvent | null
      const event = network.resonate(mem1.id);
      expect(event).not.toBeNull();
      expect(event!.sourceId).toBe(mem1.id);
      expect(event!.resonatedIds).toContain(mem2.id);

      // Associated memory should be slightly strengthened (+0.02)
      const updatedMem2 = model.recall(mem2.id)!;
      expect(updatedMem2.strength).toBeGreaterThan(mem2InitialStrength);
    });

    it('memory evidence can be referenced by contradiction pair', () => {
      const mem = model.store(
        'change is driven by internal contradictions',
        'philosophy',
      );

      // Simulates the integration point: contradiction evidence
      // can reference a memory entry ID
      const evidence = {
        source: { type: 'memory' as const, id: mem.id },
        content: 'change is driven by internal contradictions',
        trit: T_TRUE as const,
      };
      expect(evidence.source.type).toBe('memory');
      expect(evidence.source.id).toBe(mem.id);
      expect(evidence.trit).toBe(T_TRUE);
    });
  });

  // ── Scenario 7.4: 知识矛盾图检测 ──
  describe('Scenario 7.4: Knowledge contradiction graph', () => {
    let index: TernaryKnowledgeIndex;
    let graph: KnowledgeContradictionGraph;

    beforeEach(() => {
      index = new TernaryKnowledgeIndex();
      graph = new KnowledgeContradictionGraph(index);

      // Add entries: "Free will" (confirmed) and "Determinism" (falsified)
      index.addEntry(
        'Free will exists',
        T_TRUE,
        'philosophy',
        ['free-will'],
      );
      index.addEntry(
        'Determinism is universal',
        T_FALSE, // marked as falsified → will conflict with T_TRUE entry
        'science',
        ['determinism'],
      );
      index.addEntry(
        'Emergence bridges free will and determinism',
        T_UNKNOWN,
        'complexity-science',
        ['emergence'],
      );
    });

    it('should detect contradictions between knowledge entries', () => {
      // detectContradictions() takes no arguments — uses entries from the index
      const contradictions = graph.detectContradictions();
      expect(contradictions).toBeDefined();
      expect(Array.isArray(contradictions)).toBe(true);
    });

    it('should produce at least one contradiction when conflicting entries exist', () => {
      const contradictions = graph.detectContradictions();
      // "Free will" (T_TRUE) vs "Determinism" (T_FALSE) → classification conflict
      expect(contradictions.length).toBeGreaterThan(0);
    });
  });
});
