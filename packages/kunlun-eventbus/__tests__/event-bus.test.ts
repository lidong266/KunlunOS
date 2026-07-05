import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TernaryEventBus } from '../src/event-bus.js';
import { StormProtector, LoopDetector, safeInvokeHandler } from '../src/guard.js';

describe('StormProtector', () => {
  it('should allow single event', () => {
    const sp = new StormProtector(100);
    expect(sp.shouldAllow('test', 0)).toBe(true);
  });

  it('should drop non-critical events in storm mode', () => {
    const sp = new StormProtector(2);
    sp.shouldAllow('e1', 0);
    sp.shouldAllow('e2', 0);
    // threshold reached
    expect(sp.shouldAllow('e3', 0)).toBe(false);
  });

  it('should allow critical events in storm mode', () => {
    const sp = new StormProtector(2);
    sp.shouldAllow('e1', 0);
    sp.shouldAllow('e2', 0);
    expect(sp.shouldAllow('critical', 1)).toBe(true);
  });
});

describe('LoopDetector', () => {
  it('should allow normal sequence', () => {
    const ld = new LoopDetector(16);
    expect(ld.enter('a')).toBe(true);
    expect(ld.enter('b')).toBe(true);
    ld.exit();
    ld.exit();
  });

  it('should detect self-loop', () => {
    const ld = new LoopDetector(16);
    ld.enter('a');
    expect(ld.enter('a')).toBe(false);
  });

  it('should detect transitive loop', () => {
    const ld = new LoopDetector(16);
    ld.enter('a');
    ld.enter('b');
    ld.enter('c');
    expect(ld.enter('a')).toBe(false);
  });

  it('should enforce max depth', () => {
    const ld = new LoopDetector(3);
    ld.enter('a'); // depth 1
    ld.enter('b'); // depth 2
    ld.enter('c'); // depth 3
    expect(ld.enter('d')).toBe(false); // exceed
  });
});

describe('safeInvokeHandler', () => {
  it('should return ok for sync handler', async () => {
    const result = await safeInvokeHandler(() => {}, {});
    expect(result).toBe('ok');
  });

  it('should return ok for async handler', async () => {
    const result = await safeInvokeHandler(async () => {}, {});
    expect(result).toBe('ok');
  });

  it('should return error for throwing handler', async () => {
    const result = await safeInvokeHandler(() => { throw new Error('boom'); }, {});
    expect(result).toBe('error');
  });

  it('should return timeout for slow handler', async () => {
    const result = await safeInvokeHandler(
      () => new Promise(resolve => setTimeout(resolve, 200)),
      {},
      50
    );
    expect(result).toBe('timeout');
  });
});

describe('TernaryEventBus', () => {
  let bus: TernaryEventBus;

  beforeEach(() => {
    bus = new TernaryEventBus();
  });

  it('should emit and receive events', () => {
    const handler = vi.fn();
    bus.on('presence:state_change', handler);
    bus.emit('presence:state_change', {
      previous: 'WATCHING',
      current: 'AWAKE',
      trit: 1,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should filter by Trit with onTrit', () => {
    const posHandler = vi.fn();
    const negHandler = vi.fn();

    bus.onTrit('presence:pulse', 1, posHandler);
    bus.onTrit('presence:pulse', -1, negHandler);

    bus.emit('presence:pulse', { pulseType: 'user_initiated', pulseId: '1', trit: 1 });
    expect(posHandler).toHaveBeenCalledTimes(1);
    expect(negHandler).toHaveBeenCalledTimes(0);
  });

  it('should support off (unsubscribe)', () => {
    const handler = vi.fn();
    bus.on('lifecycle', handler);
    bus.off('lifecycle', handler);
    bus.emit('lifecycle', { phase: 'init', trit: 0 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should report stats', () => {
    bus.emit('lifecycle', { phase: 'running', trit: 1 });
    const stats = bus.getStats();
    expect(stats.totalEmitted).toBe(1);
    expect(stats.subscriberCount).toBe(0);
  });

  it('should not crash on emit without subscribers', () => {
    expect(() => {
      bus.emit('presence:state_change', {
        previous: 'WATCHING',
        current: 'AWAKE',
        trit: 1,
      });
    }).not.toThrow();
  });

  it('should isolate handler crashes', () => {
    const goodHandler = vi.fn();
    const badHandler = vi.fn(() => { throw new Error('crash'); });

    bus.on('lifecycle', badHandler);
    bus.on('lifecycle', goodHandler);

    bus.emit('lifecycle', { phase: 'error', trit: -1 });

    // both handlers should have been called (bad one is isolated)
    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
  });
});
