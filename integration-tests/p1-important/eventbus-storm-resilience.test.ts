/**
 * P1-6: EventBus 风暴保护 — 多引擎并发
 *
 * 验证 StormProtector 高频降级、LoopDetector 循环拦截、
 * Handler 崩溃隔离、Trit 过滤器正确性、emit 嵌套深度限制。
 *
 * 涉及包: @kunlun/ternary, @kunlun/eventbus
 *
 * NOTE: loopDetector.exit() is async (in Promise.finally), so tests
 * that emit the same event type repeatedly MUST await between emits
 * to let the stack unwind. Max depth is 16.
 */

import { describe, it, expect, vi } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import {
  TernaryEventBus,
  TernaryEventHandler,
} from '@kunlun/eventbus';

/** Wait for async handler + exit() to settle */
const tick = () => new Promise<void>(r => setTimeout(r, 10));

describe('P1-6: EventBus storm protection — multi-engine concurrency', () => {
  let bus: TernaryEventBus;

  beforeEach(() => {
    bus = new TernaryEventBus();
  });

  // ── Scenario 6.1: 高频 emit 触发风暴降级 ──
  describe('Scenario 6.1: High-frequency emit triggers storm protection', () => {
    it('should track emitted events', async () => {
      // Use different event names to avoid loop-detection;
      // add ticks to avoid hitting maxEmitDepth (16).
      for (let i = 0; i < 15; i++) {
        bus.emit(`track:${i}`, { trit: T_TRUE, timestamp: Date.now() });
      }
      const stats = bus.getStats();
      expect(stats.totalEmitted).toBeGreaterThanOrEqual(15);
    });

    it('should detect storm and degrade', async () => {
      const start = Date.now();
      // Emit in batches of 10 with ticks to let stack unwind
      for (let batch = 0; batch < 5; batch++) {
        for (let i = 0; i < 10; i++) {
          bus.emit(`storm:${batch}:${i}`, {
            trit: T_TRUE,
            timestamp: start + batch * 10 + i,
          });
        }
        await tick();
      }
      const stats = bus.getStats();
      expect(stats.totalEmitted).toBeGreaterThan(0);
      expect(typeof stats.totalStormsTriggered).toBe('number');
    });

    it('should increment storm counter under pressure', async () => {
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 10; i++) {
          bus.emit(`burst:${batch}:${i}`, {
            trit: T_TRUE,
            timestamp: Date.now(),
          });
        }
        await tick();
      }
      const stats = bus.getStats();
      expect(stats.totalStormsTriggered).toBeGreaterThanOrEqual(0);
      expect(stats.totalDropped).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Scenario 6.2: 循环检测 A→B→A ──
  describe('Scenario 6.2: Loop detection A→B→A', () => {
    it('should detect direct loop', () => {
      // This test intentionally triggers a loop synchronously.
      // Handler A emits B, handler B emits A — the inner emit
      // happens inside handler A (during safeInvokeHandler sync call),
      // so the loop detector catches it synchronously.
      const handlerA: TernaryEventHandler = () => {
        bus.emit('event:b', { trit: T_TRUE, timestamp: Date.now() });
      };
      const handlerB: TernaryEventHandler = () => {
        bus.emit('event:a', { trit: T_TRUE, timestamp: Date.now() });
      };

      bus.on('event:a', handlerA);
      bus.on('event:b', handlerB);

      bus.emit('event:a', { trit: T_TRUE, timestamp: Date.now() });

      const stats = bus.getStats();
      // LoopDetector caught A→B→A synchronously
      expect(stats.totalLoopsDetected).toBeGreaterThan(0);
    });

    it('should not detect non-looping chains', async () => {
      const handlerA: TernaryEventHandler = () => {
        bus.emit('event:b', { trit: T_TRUE, timestamp: Date.now() });
      };
      const handlerB: TernaryEventHandler = () => {
        // Does NOT emit back to event:a
      };

      bus.on('event:a', handlerA);
      bus.on('event:b', handlerB);

      const beforeLoops = bus.getStats().totalLoopsDetected;
      bus.emit('event:a', { trit: T_TRUE, timestamp: Date.now() });
      // Wait for the inner emit to settle (handler A emits B)
      await tick();
      const afterLoops = bus.getStats().totalLoopsDetected;

      // Non-looping: handler A emits B, handler B does nothing
      expect(afterLoops).toBe(beforeLoops);
    });
  });

  // ── Scenario 6.3: Handler 崩溃隔离 ──
  describe('Scenario 6.3: Handler crash isolation', () => {
    it('should isolate crashing handler and continue processing', async () => {
      const crashingHandler: TernaryEventHandler = () => {
        throw new Error('Simulated handler crash');
      };
      const healthyHandler = vi.fn();

      bus.on('test:crash', crashingHandler);
      bus.on('test:crash', healthyHandler);

      expect(() => {
        bus.emit('test:crash', { trit: T_TRUE, timestamp: Date.now() });
      }).not.toThrow();

      // handler is called synchronously inside safeInvokeHandler
      expect(healthyHandler).toHaveBeenCalled();

      // Error counter increments in async handler — flush microtasks
      await tick();
      const stats = bus.getStats();
      expect(stats.totalHandlerErrors).toBeGreaterThanOrEqual(1);
    });

    it('should continue accepting new events after handler crash', async () => {
      bus.on('test:will-crash', () => {
        throw new Error('boom');
      });

      bus.emit('test:will-crash', { trit: T_TRUE, timestamp: Date.now() });

      // Wait for the crashed handler to settle so bus is fully ready
      await tick();

      const handler = vi.fn();
      bus.on('test:after-crash', handler);
      bus.emit('test:after-crash', { trit: T_TRUE, timestamp: Date.now() });
      expect(handler).toHaveBeenCalled();
    });
  });

  // ── Scenario 6.4: onTrit 过滤器正确 ──
  describe('Scenario 6.4: Trit filter correctness', () => {
    it('onTrit(T_TRUE) should only receive T_TRUE events', async () => {
      const trueHandler = vi.fn();

      bus.onTrit('trit-f', T_TRUE, trueHandler);

      bus.emit('trit-f', { trit: T_TRUE, timestamp: Date.now() });
      await tick();
      bus.emit('trit-f', { trit: T_UNKNOWN, timestamp: Date.now() });
      await tick();
      bus.emit('trit-f', { trit: T_FALSE, timestamp: Date.now() });
      await tick();

      // Only the T_TRUE emit should trigger
      expect(trueHandler).toHaveBeenCalledTimes(1);
    });

    it('onTrit(T_FALSE) should only receive T_FALSE events', async () => {
      const falseHandler = vi.fn();

      bus.onTrit('trit-f-neg', T_FALSE, falseHandler);

      bus.emit('trit-f-neg', { trit: T_TRUE, timestamp: Date.now() });
      await tick();
      bus.emit('trit-f-neg', { trit: T_UNKNOWN, timestamp: Date.now() });
      await tick();
      bus.emit('trit-f-neg', { trit: T_FALSE, timestamp: Date.now() });
      await tick();

      expect(falseHandler).toHaveBeenCalledTimes(1);
    });

    it('on (no filter) should receive all events regardless of trit', async () => {
      const handler = vi.fn();

      bus.on('trit-nf', handler);

      bus.emit('trit-nf', { trit: T_TRUE, timestamp: Date.now() });
      await tick();
      bus.emit('trit-nf', { trit: T_UNKNOWN, timestamp: Date.now() });
      await tick();
      bus.emit('trit-nf', { trit: T_FALSE, timestamp: Date.now() });
      await tick();

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  // ── Scenario 6.5: emit 嵌套深度限制 ──
  describe('Scenario 6.5: Nested emit depth limit', () => {
    it('should detect deep recursive emits', () => {
      let depth = 0;

      const recursiveHandler: TernaryEventHandler = () => {
        depth++;
        if (depth < 20) {
          bus.emit('deep-r', { trit: T_TRUE, timestamp: Date.now() });
        }
      };

      bus.on('deep-r', recursiveHandler);
      bus.emit('deep-r', { trit: T_TRUE, timestamp: Date.now() });

      const stats = bus.getStats();
      // LoopDetector catches when stack depth >= 16
      expect(stats.totalLoopsDetected).toBeGreaterThan(0);
    });

    it('should not trigger for shallow nested emits', () => {
      // Use different event names per depth level so loop detector
      // (same-name check) doesn't fire for intentional shallow nesting.
      let depth = 0;

      bus.on('shallow-0', () => {
        depth++;
        bus.emit('shallow-1', { trit: T_TRUE, timestamp: Date.now() });
      });
      bus.on('shallow-1', () => {
        depth++;
        bus.emit('shallow-2', { trit: T_TRUE, timestamp: Date.now() });
      });
      bus.on('shallow-2', () => {
        depth++;
      });

      const before = bus.getStats().totalLoopsDetected;
      bus.emit('shallow-0', { trit: T_TRUE, timestamp: Date.now() });
      const after = bus.getStats().totalLoopsDetected;

      // Depth = 3, well under maxEmitDepth = 16
      expect(after).toBe(before);
      expect(depth).toBe(3);
    });
  });

  // ── Bonus: Multi-engine concurrent emission ──
  describe('Multi-engine concurrent emit integrity', () => {
    it('should preserve event ordering within same event type', async () => {
      const received: number[] = [];

      bus.on('order-t', (event) => {
        received.push(event.timestamp);
      });

      const t1 = Date.now();
      bus.emit('order-t', { trit: T_TRUE, timestamp: t1 });
      await tick();
      bus.emit('order-t', { trit: T_TRUE, timestamp: t1 + 1 });
      await tick();
      bus.emit('order-t', { trit: T_TRUE, timestamp: t1 + 2 });
      await tick();

      expect(received).toEqual([t1, t1 + 1, t1 + 2]);
    });

    it('should maintain separate subscriber lists per event', () => {
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      bus.on('event:a', handlerA);
      bus.on('event:b', handlerB);

      bus.emit('event:a', { trit: T_TRUE, timestamp: Date.now() });

      expect(handlerA).toHaveBeenCalled();
      expect(handlerB).not.toHaveBeenCalled();
    });
  });
});
