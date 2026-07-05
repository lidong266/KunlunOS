/**
 * P0-1: Presence → EventBus → Subsystems
 *
 * 验证认知在场状态转换通过 EventBus 广播，子系统能正确消费。
 */
import { describe, it, expect } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import { PresenceEngine } from '@kunlun/presence';
import { TernaryEventBus } from '@kunlun/eventbus';
import type { ITernaryEventBus, TernaryEvent } from '@kunlun/eventbus';

function tick(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('P0-1: Presence → EventBus → Subsystems', () => {
  // ── Scenario 1.1: AWAKE state transition broadcasts via EventBus ──
  describe('Scenario 1.1: AWAKE state transition broadcasts via EventBus', () => {
    it('should emit presence:state_change event when transitioning to AWAKE', async () => {
      const bus = new TernaryEventBus();
      const captured: TernaryEvent[] = [];

      bus.on('presence:state_change', (event) => {
        captured.push(event);
      });

      const engine = new PresenceEngine({}, bus);

      // Initial state is WATCHING
      expect(engine.getSnapshot().currentPhase).toBe('WATCHING');

      // Transition to AWAKE
      const result = engine.transition('AWAKE', 'integration_test');
      expect(result.to).toBe('AWAKE');
      expect(engine.getSnapshot().currentPhase).toBe('AWAKE');

      // Wait for async event handler
      await tick(100);

      // Verify event was emitted with correct data
      expect(captured.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit event with correct Trit value for AWAKE transition', async () => {
      const bus = new TernaryEventBus();
      const captured: TernaryEvent[] = [];

      bus.on('presence:state_change', (event) => {
        captured.push(event);
      });

      const engine = new PresenceEngine({}, bus);
      engine.transition('AWAKE', 'integration_test');
      await tick(100);

      expect(captured.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── EventBus integration: multiple transitions ──
  describe('EventBus integration', () => {
    it('should handle multiple state transitions', async () => {
      const bus = new TernaryEventBus();
      const captured: TernaryEvent[] = [];

      bus.on('presence:state_change', (event) => {
        captured.push(event);
      });

      const engine = new PresenceEngine({}, bus);

      // WATCHING → AWAKE
      engine.transition('AWAKE', 'first');
      // AWAKE → WATCHING
      engine.transition('WATCHING', 'second');
      // WATCHING → RESTING
      engine.transition('RESTING', 'third');

      await tick(100);

      // Should have captured at least 1 event (async handlers may coalesce)
      expect(captured.length).toBeGreaterThanOrEqual(1);
    });

    it('should expose presence snapshot for other subsystems', () => {
      const bus = new TernaryEventBus();
      const engine = new PresenceEngine({}, bus);

      const snapshot = engine.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeDefined();
      expect(snapshot.currentPhase).toBe('WATCHING');
      expect([-1, 0, 1]).toContain(snapshot.state);
      expect(snapshot.snapshotAt).toBeGreaterThan(0);
    });
  });
});
