import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PresenceEngine } from '../src/presence-engine.js';
import { PRESENCE_TRIT } from '../src/types.js';
import type { PresenceState, HealthStatus } from '../src/types.js';

describe('PresenceEngine', () => {
  let engine: PresenceEngine;

  beforeEach(() => {
    engine = new PresenceEngine();
  });

  describe('initialization', () => {
    it('should start in WATCHING by default', () => {
      const p = engine.getPresence();
      expect(p.state).toBe('WATCHING');
      expect(p.stateTrit).toBe(0);
    });

    it('should accept custom initial state', () => {
      const e = new PresenceEngine({ initialState: 'AWAKE' });
      expect(e.getPresence().state).toBe('AWAKE');
    });

    it('should have continuity 1.0 initially', () => {
      expect(engine.getPresence().continuityIndex).toBe(1.0);
    });
  });

  describe('transition', () => {
    it('should transition between states', () => {
      const result = engine.transition('AWAKE', 'user called');
      expect(result.from).toBe('WATCHING');
      expect(result.to).toBe('AWAKE');
    });

    it('should mark upgrade as +1 trit', () => {
      const result = engine.transition('AWAKE', 'upgrade');
      expect(result.trit).toBe(1);
    });

    it('should mark downgrade as -1 trit', () => {
      const result = engine.transition('RESTING', 'timeout');
      expect(result.trit).toBe(-1);
    });

    it('should track phase transitions', () => {
      engine.transition('AWAKE', '1');
      engine.transition('RESTING', '2');
      expect(engine.getPresence().metadata.phaseTransitions).toBe(2);
    });

    it('should record transition history', () => {
      engine.transition('AWAKE', 'test');
      expect(engine.getTransitionHistory()).toHaveLength(1);
    });
  });

  describe('pulses', () => {
    it('should record pulse history', () => {
      engine.emitPulse('user_initiated');
      expect(engine.getPulseHistory()).toHaveLength(1);
      expect(engine.getPulseHistory()[0].type).toBe('user_initiated');
    });

    it('should mark contradiction pulse as +1', () => {
      const pulse = engine.emitPulse('contradiction');
      expect(pulse.responseTrit).toBe(1);
    });

    it('should mark scheduled pulse as 0', () => {
      const pulse = engine.emitPulse('scheduled');
      expect(pulse.responseTrit).toBe(0);
    });

    it('should update continuity index', () => {
      engine.emitPulse('user_initiated');
      const idx = engine.getPresence().continuityIndex;
      expect(idx).toBe(1.0); // close pulse → boosted (capped at 1.0)
    });

    it('should update last pulse timestamp in presence', () => {
      engine.emitPulse('event_driven');
      const p = engine.getPresence();
      expect(p.lastPulseAt).toBeGreaterThan(0);
    });

    it('should cap pulse history at maxPulseHistory', () => {
      const e = new PresenceEngine({ maxPulseHistory: 3 });
      for (let i = 0; i < 5; i++) {
        e.emitPulse('scheduled');
      }
      expect(e.getPulseHistory()).toHaveLength(3);
    });
  });

  describe('distance field', () => {
    it('should return distance field with correct structure', () => {
      const df = engine.senseDistanceField();
      expect(df.cognitiveDistance).toBeGreaterThanOrEqual(0);
      expect(df.cognitiveDistance).toBeLessThanOrEqual(1);
      expect(df.cognitiveLoad).toBeGreaterThanOrEqual(0);
      expect(df.cognitiveLoad).toBeLessThanOrEqual(1);
      expect([1, 0, -1]).toContain(df.affectiveTone);
    });

    it('should reflect state in affective tone', () => {
      engine.transition('AWAKE', 'test');
      expect(engine.senseDistanceField().affectiveTone).toBe(1);

      engine.transition('RESTING', 'test');
      expect(engine.senseDistanceField().affectiveTone).toBe(-1);
    });

    it('should increase cognitive load with contradictions', () => {
      engine.incrementContradictions();
      engine.incrementContradictions();
      engine.incrementContradictions();
      expect(engine.senseDistanceField().cognitiveLoad).toBeCloseTo(0.3, 1);
    });
  });

  describe('contradiction tracking', () => {
    it('should increment and decrement', () => {
      engine.incrementContradictions();
      engine.incrementContradictions();
      expect(engine.getPresence().activeContradictions).toBe(2);

      engine.decrementContradictions();
      expect(engine.getPresence().activeContradictions).toBe(1);
      expect(engine.getPresence().metadata.contradictionResolved).toBe(1);
    });

    it('should not go below zero', () => {
      engine.decrementContradictions();
      expect(engine.getPresence().activeContradictions).toBe(0);
    });
  });

  describe('health check', () => {
    it('should report healthy initially', () => {
      const report = engine.healthCheck();
      expect(report.status).toBe('HEALTHY');
      expect(report.trit).toBe(1);
    });

    it('should report degraded after idle timeout', () => {
      vi.useFakeTimers();
      const e = new PresenceEngine({ idleTimeoutMs: 500, restTimeoutMs: 100_000 });
      vi.advanceTimersByTime(1000); // advance past idle timeout
      const report = e.healthCheck();
      expect(report.status).toBe('DEGRADED');
      expect(report.trit).toBe(0);
      vi.useRealTimers();
    });

    it('should report unhealthy after rest timeout', () => {
      vi.useFakeTimers();
      const e = new PresenceEngine({ idleTimeoutMs: 500, restTimeoutMs: 1000 });
      vi.advanceTimersByTime(1500); // advance past rest timeout
      const report = e.healthCheck();
      expect(report.status).toBe('UNHEALTHY');
      expect(report.trit).toBe(-1);
      vi.useRealTimers();
    });
  });

  describe('snapshot', () => {
    it('should produce serializable snapshot', () => {
      const snap = engine.getSnapshot();
      expect(snap.id).toBeDefined();
      expect(snap.state).toBe(0); // WATCHING
      expect(snap.distanceFieldJson).toBeTypeOf('string');
      // Should be parseable
      JSON.parse(snap.distanceFieldJson);
    });
  });
});
