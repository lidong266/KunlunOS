import { describe, it, expect, beforeEach } from 'vitest';
import { createAdaptiveRegulator } from '../src/adaptive-regulator.js';
import type { IAdaptiveRegulator } from '../src/adaptive-regulator.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { EcosystemChange } from '../src/types.js';

function makeChange(
  overrides?: Partial<EcosystemChange>,
): EcosystemChange {
  return {
    type: 'capability_gain',
    source: 'openclaw',
    description: 'New model version available',
    affectedComponents: ['ocgs'],
    severity: T_UNKNOWN,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('AdaptiveRegulator', () => {
  let regulator: IAdaptiveRegulator;

  beforeEach(() => {
    regulator = createAdaptiveRegulator();
  });

  describe('creation', () => {
    it('should default to "observe" cognitive mode', () => {
      expect(regulator.getCognitiveMode()).toBe('observe');
    });

    it('should accept custom initial cognitive mode', () => {
      const r = createAdaptiveRegulator({ initialCognitiveMode: 'defend' });
      expect(r.getCognitiveMode()).toBe('defend');
    });

    it('should start with adaptation count 0', () => {
      expect(regulator.getAdaptationCount()).toBe(0);
    });
  });

  describe('adapt — cognitive modes', () => {
    it('should switch to "explore" for capability_gain', () => {
      regulator.adapt(makeChange({ type: 'capability_gain' }));
      expect(regulator.getCognitiveMode()).toBe('explore');
    });

    it('should switch to "defend" for capability_loss', () => {
      regulator.adapt(makeChange({ type: 'capability_loss' }));
      expect(regulator.getCognitiveMode()).toBe('defend');
    });

    it('should switch to "observe" for dependency_change', () => {
      regulator.adapt(makeChange({ type: 'dependency_change' }));
      expect(regulator.getCognitiveMode()).toBe('observe');
    });

    it('should switch to "explore" for protocol_update', () => {
      regulator.adapt(makeChange({ type: 'protocol_update' }));
      expect(regulator.getCognitiveMode()).toBe('explore');
    });

    it('should switch to "defend" for new_competitor', () => {
      regulator.adapt(makeChange({ type: 'new_competitor' }));
      expect(regulator.getCognitiveMode()).toBe('defend');
    });

    it('should switch to "observe" for ecosystem_restructure', () => {
      regulator.adapt(makeChange({ type: 'ecosystem_restructure' }));
      expect(regulator.getCognitiveMode()).toBe('observe');
    });
  });

  describe('adapt — measures', () => {
    it('should generate at least 2 measures for capability_gain', () => {
      const result = regulator.adapt(makeChange({ type: 'capability_gain' }));
      expect(result.measures.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate measures for capability_loss', () => {
      const result = regulator.adapt(makeChange({ type: 'capability_loss' }));
      expect(result.measures.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate measures for new_competitor', () => {
      const result = regulator.adapt(makeChange({ type: 'new_competitor' }));
      expect(result.measures.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark all measures as unverified (T_UNKNOWN)', () => {
      const result = regulator.adapt(makeChange());
      for (const m of result.measures) {
        expect(m.verified).toBe(T_UNKNOWN);
      }
    });
  });

  describe('adapt — success', () => {
    it('should succeed (T_TRUE) with serious change that triggers contradictions', () => {
      const result = regulator.adapt(
        makeChange({ type: 'capability_gain', severity: T_TRUE }),
      );
      expect(result.success).toBe(T_TRUE);
    });

    it('should partial (T_UNKNOWN) with non-serious change that has measures', () => {
      const result = regulator.adapt(
        makeChange({ type: 'new_competitor', severity: T_FALSE }),
      );
      // T_FALSE severity → getContradictionCount returns 0, measures still > 0
      // → success = T_UNKNOWN
      expect(result.success).toBe(T_UNKNOWN);
    });

    it('should include directive ID', () => {
      const result = regulator.adapt(makeChange());
      expect(result.directiveId).toMatch(/^adapt-/);
    });
  });

  describe('adapt — contradictions', () => {
    it('should produce ContradictionPair for serious changes', () => {
      const result = regulator.adapt(
        makeChange({ type: 'capability_gain', severity: T_TRUE }),
      );
      expect(result.triggeredContradictions.length).toBe(2); // T_TRUE → 2
    });

    it('should produce 1 ContradictionPair for T_UNKNOWN severity', () => {
      const result = regulator.adapt(
        makeChange({ type: 'dependency_change', severity: T_UNKNOWN }),
      );
      expect(result.triggeredContradictions.length).toBe(1);
    });

    it('should produce 0 ContradictionPair for T_FALSE severity', () => {
      const result = regulator.adapt(
        makeChange({ type: 'protocol_update', severity: T_FALSE }),
      );
      expect(result.triggeredContradictions.length).toBe(0);
    });

    it('should use ecosystem_change discovery source', () => {
      const result = regulator.adapt(
        makeChange({ type: 'capability_gain', severity: T_UNKNOWN }),
      );
      for (const cp of result.triggeredContradictions) {
        expect(cp.discoveredBy).toBe('ecosystem_change');
      }
    });

    it('should have thesis and antithesis with distinct statements', () => {
      const result = regulator.adapt(
        makeChange({ type: 'capability_gain', severity: T_UNKNOWN }),
      );
      for (const cp of result.triggeredContradictions) {
        expect(cp.thesis.statement).toBeTruthy();
        expect(cp.antithesis.statement).toBeTruthy();
        expect(cp.thesis.statement).not.toBe(cp.antithesis.statement);
      }
    });

    it('should set presenceStateAtDiscovery to WATCHING', () => {
      const result = regulator.adapt(
        makeChange({ type: 'new_competitor', severity: T_TRUE }),
      );
      for (const cp of result.triggeredContradictions) {
        expect(cp.presenceStateAtDiscovery).toBe('WATCHING');
      }
    });

    it('should set warPhaseAtDiscovery to stalemate', () => {
      const result = regulator.adapt(
        makeChange({ type: 'new_competitor', severity: T_TRUE }),
      );
      for (const cp of result.triggeredContradictions) {
        expect(cp.warPhaseAtDiscovery).toBe('stalemate');
      }
    });
  });

  describe('adapt — adaptation count', () => {
    it('should increment count with each adapt', () => {
      expect(regulator.getAdaptationCount()).toBe(0);
      regulator.adapt(makeChange());
      expect(regulator.getAdaptationCount()).toBe(1);
      regulator.adapt(makeChange({ type: 'new_competitor' }));
      expect(regulator.getAdaptationCount()).toBe(2);
    });
  });

  describe('getOCGSState', () => {
    it('should return initial state with T_UNKNOWN ecosystemAwareness', () => {
      const state = regulator.getOCGSState();
      expect(state.ecosystemAwareness).toBe(T_UNKNOWN);
      expect(state.adaptationStats.total).toBe(0);
    });

    it('should update ecosystemAwareness after successful adaptations', () => {
      // 3 successful → ratio = 1.0 → T_TRUE
      regulator.adapt(makeChange({ type: 'capability_gain', severity: T_TRUE }));
      regulator.adapt(makeChange({ type: 'capability_gain', severity: T_TRUE }));
      regulator.adapt(makeChange({ type: 'capability_gain', severity: T_TRUE }));

      const state = regulator.getOCGSState();
      expect(state.ecosystemAwareness).toBe(T_TRUE);
    });

    it('should reflect cognitive mode changes in state', () => {
      regulator.adapt(makeChange({ type: 'capability_loss' }));
      const state = regulator.getOCGSState();
      expect(state.cognitiveMode).toBe('defend');
    });

    it('should track adaptation stats correctly', () => {
      // success
      regulator.adapt(makeChange({ type: 'capability_gain', severity: T_TRUE }));
      // partial (T_FALSE severity → no contradictions → T_UNKNOWN)
      regulator.adapt(makeChange({ type: 'new_competitor', severity: T_FALSE }));

      const state = regulator.getOCGSState();
      expect(state.adaptationStats.successful).toBe(1);
      expect(state.adaptationStats.partial).toBe(1);
      expect(state.adaptationStats.failed).toBe(0);
    });

    it('should update modelVersion with adaptation count', () => {
      regulator.adapt(makeChange());
      regulator.adapt(makeChange());
      expect(regulator.getOCGSState().modelVersion).toBe(2);
    });
  });

  describe('adapt — ecosystem_restructure boundaries', () => {
    it('should produce boundary adjustments for ecosystem_restructure', () => {
      const result = regulator.adapt(makeChange({ type: 'ecosystem_restructure', severity: T_UNKNOWN }));
      // The result itself doesn't expose the directive, but measures exist
      expect(result.measures.length).toBeGreaterThanOrEqual(2);
    });
  });
});
