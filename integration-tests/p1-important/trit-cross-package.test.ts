/**
 * P1-5: Trit 跨包一致性
 *
 * 验证所有包对 Trit(+1/0/-1) 的语义理解一致；
 * Tryte 信度向量编解码无损；Trit 映射表跨包统一。
 *
 * 涉及包: @kunlun/ternary, 所有包
 */

import { describe, it, expect } from 'vitest';
import {
  Trit, T_TRUE, T_UNKNOWN, T_FALSE,
  Tryte, tryteToValue, valueToTryte,
  K3,
} from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';

// Re-import Trit constants from ternary to verify consistency
// (other packages re-export from ternary transitively via type system)

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

describe('P1-5: Trit cross-package consistency', () => {
  // ── Scenario 5.1: 所有包导入同一 Trit 值 ──
  describe('Scenario 5.1: Trit values are consistent', () => {
    it('T_TRUE === 1', () => {
      expect(T_TRUE).toBe(1 as Trit);
    });

    it('T_UNKNOWN === 0', () => {
      expect(T_UNKNOWN).toBe(0 as Trit);
    });

    it('T_FALSE === -1', () => {
      expect(T_FALSE).toBe(-1 as Trit);
    });

    it('PRESENCE_TRIT maps are valid Trit values', async () => {
      const { PRESENCE_TRIT } = await import('@kunlun/presence');
      const values: number[] = Object.values(PRESENCE_TRIT);
      for (const v of values) {
        expect([-1, 0, 1]).toContain(v);
      }
      // AWAKE = +1, RESTING = -1
      expect(PRESENCE_TRIT['AWAKE']).toBe(1);
      expect(PRESENCE_TRIT['RESTING']).toBe(-1);
    });
  });

  // ── Scenario 5.2: Tryte 编解码往返 ──
  describe('Scenario 5.2: Tryte encode-decode roundtrip', () => {
    it('valueToTryte → tryteToValue roundtrip for integer value', () => {
      const original = 200;
      const tryte = valueToTryte(original);
      const decoded = tryteToValue(tryte);
      expect(Math.abs(original - decoded)).toBeLessThan(1);
    });

    it('valueToTryte → tryteToValue roundtrip for small value', () => {
      const original = 42;
      const tryte = valueToTryte(original);
      const decoded = tryteToValue(tryte);
      expect(Math.abs(original - decoded)).toBeLessThan(1);
    });

    it('valueToTryte → tryteToValue roundtrip for zero', () => {
      const tryte = valueToTryte(0);
      const decoded = tryteToValue(tryte);
      expect(Math.abs(0 - decoded)).toBeLessThan(1);
    });

    it('valueToTryte → tryteToValue roundtrip for large value', () => {
      const original = 728;
      const tryte = valueToTryte(original);
      const decoded = tryteToValue(tryte);
      expect(Math.abs(original - decoded)).toBeLessThan(1);
    });
  });

  // ── Scenario 5.3: Tryte 跨包传递 ──
  describe('Scenario 5.3: Tryte passing across packages', () => {
    it('Tryte passes through JSON roundtrip without loss', () => {
      const original: Tryte = [T_TRUE, T_UNKNOWN, T_FALSE, T_TRUE, T_UNKNOWN, T_TRUE] as Tryte;
      const json = JSON.stringify(original);
      const parsed: number[] = JSON.parse(json);
      expect(parsed).toEqual([1, 0, -1, 1, 0, 1]);
    });

    it('Tryte from ternary compatible with subsystems confidence vector', () => {
      const cv: Tryte = valueToTryte(150);
      expect(Array.isArray(cv)).toBe(true);
      expect(cv).toHaveLength(6);
      for (const dim of cv) {
        expect([-1, 0, 1]).toContain(dim);
      }
    });
  });

  // ── Scenario 5.4: Trit映射表跨包一致性 ──
  describe('Scenario 5.4: Trit semantic maps consistent across packages', () => {
    it('PRESENCE_TRIT maps are valid Trit values', async () => {
      const { PRESENCE_TRIT } = await import('@kunlun/presence');
      const values: number[] = Object.values(PRESENCE_TRIT);
      for (const v of values) {
        expect([-1, 0, 1]).toContain(v);
      }
      expect(PRESENCE_TRIT['AWAKE']).toBe(1);
      expect(PRESENCE_TRIT['RESTING']).toBe(-1);
    });

    it('Subsystems Diting signal reliability map uses valid Trit values', async () => {
      const { SIGNAL_RELIABILITY_INIT, tryteToTrits } = await import('@kunlun/subsystems');
      for (const reliability of Object.values(SIGNAL_RELIABILITY_INIT)) {
        const trits = tryteToTrits(reliability);
        for (const trit of trits) {
          expect([-1, 0, 1]).toContain(trit);
        }
      }
    });
  });

  // ── Scenario 5.5: K3 逻辑跨包使用 ──
  describe('Scenario 5.5: K3 logic consistent across packages', () => {
    it('K3.and(1, 0) === 0', () => {
      expect(K3.and(T_TRUE, T_UNKNOWN)).toBe(T_UNKNOWN);
    });

    it('K3.and(1, 1) === 1', () => {
      expect(K3.and(T_TRUE, T_TRUE)).toBe(T_TRUE);
    });

    it('K3.or(1, 0) === 1', () => {
      expect(K3.or(T_TRUE, T_UNKNOWN)).toBe(T_TRUE);
    });

    it('K3.or(-1, 0) === 0', () => {
      expect(K3.or(T_FALSE, T_UNKNOWN)).toBe(T_UNKNOWN);
    });

    it('K3.not(1) === -1', () => {
      expect(K3.not(T_TRUE)).toBe(T_FALSE);
    });

    it('K3.not(0) === 0', () => {
      expect(K3.not(T_UNKNOWN)).toBe(T_UNKNOWN);
    });

    it('K3 operator used inside contradiction engine returns valid Trit output', () => {
      const engine = createContradictionEngine();
      const result = engine.analyzeSingle({
        id: 'k3-test',
        thesis: makeProp('dialectical materialism', T_TRUE),
        antithesis: makeProp('mechanical materialism', T_UNKNOWN),
        contradictionType: 'antagonistic',
        priority: 1,
        discoveredAt: Date.now(),
        warPhaseAtDiscovery: 'strategic_defense',
        relatedContradictions: [],
      });
      expect([-1, 0, 1]).toContain(result.analysis.unifiability);
    });
  });
});
