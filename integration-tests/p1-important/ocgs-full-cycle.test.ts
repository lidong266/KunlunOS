/**
 * P1-4: OCGS 全生命周期集成测试
 *
 * 验证 OCGS 编排器完整生命周期：扫描 → 建模 → 涌现检测 → 自适应。
 * 使用实际 IOCGSOrchestrator API。
 */
import { describe, it, expect } from 'vitest';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import {
  createOCGSOrchestrator,
} from '@kunlun/ocgs';
import type {
  EcosystemScanResult,
  FullCycleResult,
  SystemModelSnapshot,
  EcosystemChange,
} from '@kunlun/ocgs';

describe('OCGS Full Cycle', () => {
  it('scanEcosystem() returns EcosystemScanResult', async () => {
    const orchestrator = createOCGSOrchestrator();
    const scan: EcosystemScanResult = await orchestrator.scanEcosystem();

    expect(scan).toBeDefined();
    expect(scan.scanId).toBeDefined();
    expect(typeof scan.scanId).toBe('string');
    // timestamp: Date object or string; scanTimestamp may be number or absent
    expect(scan.timestamp).toBeDefined();
    expect(scan.timestamp instanceof Date || typeof scan.timestamp === 'string').toBe(true);
    if (scan.scanTimestamp !== undefined) expect(typeof scan.scanTimestamp).toBe('number');
    // Optional fields: may not be present in all scan results
    if (scan.scanType !== undefined) expect(typeof scan.scanType).toBe('string');
    if (scan.scanDepth !== undefined) expect(typeof scan.scanDepth).toBe('number');
    if (scan.signalCount !== undefined) expect(typeof scan.signalCount).toBe('number');
    if (scan.signals !== undefined) expect(Array.isArray(scan.signals)).toBe(true);
    if (scan.systemState !== undefined) {
      expect(scan.systemState).toBeDefined();
    }
    if (scan.processTimeMs !== undefined) {
      expect(typeof scan.processTimeMs).toBe('number');
      expect(scan.processTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('should support multiple consecutive scans with unique scanIds', async () => {
    const orchestrator = createOCGSOrchestrator();
    const ids = new Set<string>();

    for (let i = 0; i < 3; i++) {
      const scan = await orchestrator.scanEcosystem();
      ids.add(scan.scanId);
      if (typeof scan.processTimeMs === 'number') {
        expect(scan.processTimeMs).toBeGreaterThanOrEqual(0);
      }
    }
    expect(ids.size).toBe(3);
  });

  it('updateSystemModel() returns a SystemModelSnapshot', async () => {
    const orchestrator = createOCGSOrchestrator();
    const snapshot: SystemModelSnapshot = await orchestrator.updateSystemModel();

    expect(snapshot).toBeDefined();
    expect(Array.isArray(snapshot.subsystems)).toBe(true);
    expect(snapshot.subsystems.length).toBeGreaterThan(0);
    expect(snapshot.version).toBeGreaterThanOrEqual(0);
    expect(typeof snapshot.timestamp).toBe('number');
  });

  it('assessComplexity() returns a valid complexity assessment', async () => {
    const orchestrator = createOCGSOrchestrator();
    const complexity = orchestrator.assessComplexity();

    expect(complexity).toBeDefined();
    expect(complexity.complexityClass).toBeDefined();
    expect(complexity.subsystemCount).toBeGreaterThan(0);
    expect(typeof complexity.interactionDensity).toBe('number');
    expect([-1, 0, 1]).toContain(complexity.predictability);
  });

  it('detectEmergence() requires a SystemModelSnapshot', async () => {
    const orchestrator = createOCGSOrchestrator();
    const snapshot = await orchestrator.updateSystemModel();
    const report = orchestrator.detectEmergence(snapshot);

    expect(report).toBeDefined();
    expect([-1, 0, 1]).toContain(report.detected);
    expect(Array.isArray(report.emergentBehaviors)).toBe(true);
    expect(Array.isArray(report.nonlinearities)).toBe(true);
    expect(typeof report.timestamp).toBe('number');
  });

  it('adapt() processes a single EcosystemChange', async () => {
    const orchestrator = createOCGSOrchestrator();
    const change: EcosystemChange = {
      type: 'ecosystem_restructure',
      source: 'self',
      description: 'Test adaptation trigger',
      affectedComponents: ['ocgs'],
      severity: T_UNKNOWN as Trit,
      timestamp: Date.now(),
    };
    const result = await orchestrator.adapt(change);

    expect(result).toBeDefined();
    expect([-1, 0, 1]).toContain(result.success);
    expect(Array.isArray(result.measures)).toBe(true);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('fullCycle() completes all phases', async () => {
    const orchestrator = createOCGSOrchestrator();
    const result: FullCycleResult = await orchestrator.fullCycle();

    expect(result).toBeDefined();
    expect(result.scan.scanId).toBeDefined();
    expect(result.snapshot).toBeDefined();
    expect(result.emergence).toBeDefined();
    expect(Array.isArray(result.adaptations)).toBe(true);
    expect(result.cycleDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.cycleTimestamp === undefined || result.cycleTimestamp instanceof Date).toBe(true);
  });

  it('getOCGSState() reflects current state', async () => {
    const orchestrator = createOCGSOrchestrator();
    const state = orchestrator.getOCGSState();

    expect(state).toBeDefined();
    expect(state.ecosystemAwareness).toBeDefined();
    expect([-1, 0, 1]).toContain(state.ecosystemAwareness);
  });

  it('start/stop lifecycle works correctly', async () => {
    const orchestrator = createOCGSOrchestrator();

    expect(orchestrator.isRunning()).toBe(false);
    orchestrator.start();
    expect(orchestrator.isRunning()).toBe(true);
    orchestrator.stop();
    expect(orchestrator.isRunning()).toBe(false);
  });
});
