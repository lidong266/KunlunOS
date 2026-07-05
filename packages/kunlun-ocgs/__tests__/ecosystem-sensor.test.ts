import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createEcosystemSensor } from '../src/ecosystem-sensor.js';
import type { IEcosystemSensor } from '../src/ecosystem-sensor.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

describe('EcosystemSensor', () => {
  let sensor: IEcosystemSensor;

  beforeEach(() => {
    sensor = createEcosystemSensor({ timeoutMs: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create with default config', () => {
      expect(sensor).toBeDefined();
      expect(sensor.getListenerCount()).toBe(0);
    });

    it('should create with custom enabledSources', () => {
      const s = createEcosystemSensor({
        timeoutMs: 3000,
        enabledSources: ['self'],
      });
      expect(s).toBeDefined();
    });
  });

  describe('scanEcosystem', () => {
    it('should return scan result with all 9 sources by default', async () => {
      const result = await sensor.scanEcosystem();

      expect(result).toBeDefined();
      expect(result.scanId).toMatch(/^scan-/);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.sourceDetails.length).toBe(9);
      expect(result.stats.sourcesScanned).toBe(9);
    });

    it('should include self source signals', async () => {
      const result = await sensor.scanEcosystem();
      const selfDetail = result.sourceDetails.find((d) => d.source === 'self');

      expect(selfDetail).toBeDefined();
      expect(selfDetail!.status).toBe('ok');
      expect(selfDetail!.signals.length).toBeGreaterThanOrEqual(2);
    });

    it('should mark openclaw and mcp_topology as stub for MVP', async () => {
      const result = await sensor.scanEcosystem();

      const openclaw = result.sourceDetails.find((d) => d.source === 'openclaw');
      const mcp = result.sourceDetails.find((d) => d.source === 'mcp_topology');

      expect(openclaw).toBeDefined();
      expect(openclaw!.status).toBe('stub');
      expect(mcp).toBeDefined();
      expect(mcp!.status).toBe('stub');
    });

    it('should mark hermes/clawhub/agent/tool/model/user_behavior as stub', async () => {
      const result = await sensor.scanEcosystem();

      const stubSources = [
        'hermes', 'clawhub', 'agent_ecosystem',
        'tool_ecosystem', 'model_ecosystem', 'user_behavior',
      ];
      for (const source of stubSources) {
        const detail = result.sourceDetails.find((d) => d.source === source);
        expect(detail).toBeDefined();
        expect(detail!.status).toBe('stub');
      }
    });

    it('should aggregate all signals across sources', async () => {
      const result = await sensor.scanEcosystem();

      // self has 2+ signals, rest have 1 stub each → at least 10 signals
      expect(result.signals.length).toBeGreaterThanOrEqual(10);
    });

    it('should compute ecosystemHealth', async () => {
      const result = await sensor.scanEcosystem();

      expect([T_TRUE, T_UNKNOWN, T_FALSE]).toContain(result.ecosystemHealth);
    });

    it('should track latency stats', async () => {
      const result = await sensor.scanEcosystem();

      expect(result.stats.totalLatencyMs).toBeGreaterThan(0);
    });

    it('should handle only self source scan', async () => {
      const s = createEcosystemSensor({
        timeoutMs: 3000,
        enabledSources: ['self'],
      });

      const result = await s.scanEcosystem();

      expect(result.sourceDetails.length).toBe(1);
      expect(result.stats.sourcesScanned).toBe(1);
    });

    it('should produce incrementing scan IDs', async () => {
      const r1 = await sensor.scanEcosystem();
      const r2 = await sensor.scanEcosystem();

      expect(r1.scanId).not.toBe(r2.scanId);
    });
  });

  describe('event listeners', () => {
    it('should register and count listeners', () => {
      const id1 = sensor.onEcosystemEvent('self', () => {});
      expect(sensor.getListenerCount()).toBe(1);

      const id2 = sensor.onEcosystemEvent('openclaw', () => {});
      expect(sensor.getListenerCount()).toBe(2);
    });

    it('should return unique listener IDs', () => {
      const id1 = sensor.onEcosystemEvent('self', () => {});
      const id2 = sensor.onEcosystemEvent('self', () => {});

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^listener-/);
    });

    it('should remove listeners', () => {
      const id = sensor.onEcosystemEvent('self', () => {});
      expect(sensor.getListenerCount()).toBe(1);

      const removed = sensor.offEcosystemEvent(id);
      expect(removed).toBe(true);
      expect(sensor.getListenerCount()).toBe(0);
    });

    it('should return false for non-existent listener removal', () => {
      const removed = sensor.offEcosystemEvent('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getLastScanResult', () => {
    it('should return null before any scan', () => {
      expect(sensor.getLastScanResult()).toBeNull();
    });

    it('should return last result after scan', async () => {
      await sensor.scanEcosystem();
      const last = sensor.getLastScanResult();

      expect(last).not.toBeNull();
      expect(last!.signals.length).toBeGreaterThan(0);
    });

    it('should update last result with each scan', async () => {
      const r1 = await sensor.scanEcosystem();
      const r2 = await sensor.scanEcosystem();
      const last = sensor.getLastScanResult();

      expect(last!.scanId).toBe(r2.scanId);
      expect(last!.scanId).not.toBe(r1.scanId);
    });
  });
});
