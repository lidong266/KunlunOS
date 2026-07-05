import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createOCGSOrchestrator } from '../src/orchestrator.js';
import type { IOCGSOrchestrator } from '../src/orchestrator.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import { createSystemModel } from '../src/system-model.js';

describe('OCGSOrchestrator', () => {
  let orchestrator: IOCGSOrchestrator;

  beforeEach(() => {
    orchestrator = createOCGSOrchestrator({
      scanTimeoutMs: 5000,
      enabledSources: ['self'],
      minAdaptationIntervalMs: 0, // disable rate limiting for tests
      emergenceDetectionEnabled: false,
      verbose: false,
    });
  });

  afterEach(() => {
    orchestrator.stop();
    vi.restoreAllMocks();
  });

  describe('creation', () => {
    it('should create with default config when no config given', () => {
      const o = createOCGSOrchestrator();
      expect(o).toBeDefined();
      expect(o.isRunning()).toBe(false);
    });

    it('should accept partial config override', () => {
      const o = createOCGSOrchestrator({ verbose: true, scanIntervalMs: 9999 });
      const cfg = o.getConfig();
      expect(cfg.verbose).toBe(true);
      expect(cfg.scanIntervalMs).toBe(9999);
    });
  });

  describe('scanEcosystem', () => {
    it('should scan and return result', async () => {
      const result = await orchestrator.scanEcosystem();
      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.sourceDetails.length).toBe(1); // only 'self' enabled
    });

    it('should produce valid scan ID', async () => {
      const result = await orchestrator.scanEcosystem();
      expect(result.scanId).toMatch(/^scan-/);
    });
  });

  describe('updateSystemModel', () => {
    it('should return snapshot after update', async () => {
      const snapshot = await orchestrator.updateSystemModel();
      expect(snapshot.subsystems.length).toBeGreaterThan(0);
      expect(snapshot.version).toBeGreaterThan(0);
    });
  });

  describe('assessComplexity', () => {
    it('should return complexity assessment', () => {
      const assessment = orchestrator.assessComplexity();
      expect(assessment.complexityClass).toBeDefined();
      expect(assessment.subsystemCount).toBeGreaterThan(0);
    });
  });

  describe('detectEmergence', () => {
    it('should return phase 5 emergence report', () => {
      const snap = createSystemModel().getSnapshot();
      const report = orchestrator.detectEmergence(snap);

      // Phase 5 real detector: default model has low density (5/7 ≈ 0.71), no emergence
      expect(report.detected).toBe(T_FALSE);
      expect(report.detectorVersion).toBe('0.2.0-phase5');
    });
  });

  describe('adapt', () => {
    it('should adapt to change and return result', async () => {
      const change = {
        type: 'capability_gain' as const,
        source: 'openclaw' as const,
        description: 'test change',
        affectedComponents: ['ocgs'],
        severity: T_TRUE,
        timestamp: Date.now(),
      };

      const result = await orchestrator.adapt(change);
      expect(result.measures.length).toBeGreaterThan(0);
      expect(result.success).toBe(T_TRUE);
    });
  });

  describe('fullCycle', () => {
    it('should execute complete scan→model→emergence→adapt cycle', async () => {
      const result = await orchestrator.fullCycle();

      expect(result.scan).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.emergence).toBeDefined();
      expect(result.adaptations).toBeDefined();
      expect(result.cycleTimestamp).toBeInstanceOf(Date);
      expect(result.cycleDurationMs).toBeGreaterThan(0);
    });

    it('should return disabled emergence report when detection disabled', async () => {
      const result = await orchestrator.fullCycle();
      expect(result.emergence.detectorVersion).toBe('disabled');
      expect(result.emergence.detected).toBe(T_UNKNOWN);
    });
  });

  describe('getOCGSState', () => {
    it('should return OCGS state', () => {
      const state = orchestrator.getOCGSState();
      expect(state.ecosystemAwareness).toBeDefined();
      expect(state.complexityClass).toBeDefined();
      expect(state.cognitiveMode).toBe('observe');
    });

    it('should reflect adaptations in state', async () => {
      // Run a full cycle to generate adaptations
      await orchestrator.fullCycle();

      const state = orchestrator.getOCGSState();
      expect(state.lastAdaptationAt).not.toBeNull();
    });
  });

  describe('start / stop', () => {
    it('should start as not running', () => {
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should start interval loop', () => {
      orchestrator.start();
      expect(orchestrator.isRunning()).toBe(true);
    });

    it('should stop interval loop', () => {
      orchestrator.start();
      orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);
    });

    it('should not restart if already running', () => {
      orchestrator.start();
      orchestrator.start(); // double start
      orchestrator.stop();
      expect(orchestrator.isRunning()).toBe(false);
    });
  });

  describe('event listeners', () => {
    it('should delegate event registration to sensor', () => {
      const id = orchestrator.onEcosystemEvent('self', () => {});
      expect(id).toMatch(/^listener-/);

      const removed = orchestrator.offEcosystemEvent(id);
      expect(removed).toBe(true);
    });

    it('should return false for invalid listener removal', () => {
      expect(orchestrator.offEcosystemEvent('nonexistent')).toBe(false);
    });
  });

  describe('rate limiting (minAdaptationIntervalMs)', () => {
    it('should adapt normally when rate limit is 0', async () => {
      const change = {
        type: 'capability_gain' as const,
        source: 'openclaw' as const,
        description: 'test',
        affectedComponents: ['ocgs'],
        severity: T_TRUE,
        timestamp: Date.now(),
      };

      const r1 = await orchestrator.adapt(change);
      expect(r1.success).toBe(T_TRUE);
    });

    it('should rate-limit with positive minAdaptationIntervalMs', async () => {
      const o = createOCGSOrchestrator({
        enabledSources: ['self'],
        minAdaptationIntervalMs: 60000, // 1 minute
        verbose: false,
      });

      const change = {
        type: 'capability_gain' as const,
        source: 'openclaw' as const,
        description: 'test',
        affectedComponents: ['ocgs'],
        severity: T_TRUE,
        timestamp: Date.now(),
      };

      // First adaptation should work
      const r1 = await o.adapt(change);
      expect(r1.success).toBe(T_TRUE);

      // Second adaptation within minInterval should be rate-limited
      const r2 = await o.adapt(change);
      expect(r2.directiveId).toBe('rate-limited');
      expect(r2.triggeredContradictions.length).toBe(0);

      o.stop();
    });
  });
});
