import { describe, it, expect, beforeEach } from 'vitest';
import { createEmergenceDetector } from '../src/emergence-detector.js';
import type { IEmergenceDetector } from '../src/emergence-detector.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type {
  SystemModelSnapshot,
  SubsystemDescriptor,
  Interaction,
} from '../src/types.js';

// ═══════════════════════════════════════════════════════════════
// 测试辅助函数
// ═══════════════════════════════════════════════════════════════

function sub(name: string, overrides?: Partial<SubsystemDescriptor>): SubsystemDescriptor {
  return {
    name,
    status: T_TRUE,
    dependencies: [],
    dependents: [],
    load: 0.0,
    metadata: {},
    ...overrides,
  };
}

function ix(from: string, to: string, overrides?: Partial<Interaction>): Interaction {
  return {
    from,
    to,
    type: 'default',
    frequency: 1.0,
    quality: T_TRUE,
    ...overrides,
  };
}

function makeSnapshot(overrides?: Partial<SystemModelSnapshot>): SystemModelSnapshot {
  return {
    subsystems: overrides?.subsystems ?? [
      sub('ocgs', { load: 0.2 }),
      sub('ecosystem-sensor', { load: 0.3 }),
    ],
    interactions: overrides?.interactions ?? [
      ix('ocgs', 'ecosystem-sensor', { type: 'control' }),
    ],
    emergentProperties: overrides?.emergentProperties ?? [],
    boundaries: overrides?.boundaries ?? { hard: [], soft: [], fuzzy: [] },
    version: overrides?.version ?? 1,
    timestamp: overrides?.timestamp ?? Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Phase 5 测试套件
// ═══════════════════════════════════════════════════════════════

describe('EmergenceDetector (Phase 5 — 真实涌现检测)', () => {
  let detector: IEmergenceDetector;

  beforeEach(() => {
    detector = createEmergenceDetector();
  });

  // ─── 版本与基础设施 ───────────────────────────────────────

  describe('detector version', () => {
    it('should be version 0.2.0-phase5', () => {
      expect(detector.getDetectorVersion()).toBe('0.2.0-phase5');
    });
  });

  describe('report count', () => {
    it('should start at 0', () => {
      expect(detector.getReportCount()).toBe(0);
    });

    it('should increment with each detection', () => {
      detector.detectEmergence(makeSnapshot());
      detector.detectEmergence(makeSnapshot());
      detector.detectEmergence(makeSnapshot());
      expect(detector.getReportCount()).toBe(3);
    });
  });

  // ─── 边界条件 ─────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return T_FALSE for empty system', () => {
      const report = detector.detectEmergence(makeSnapshot({ subsystems: [] }));
      expect(report.detected).toBe(T_FALSE);
      expect(report.emergentBehaviors).toHaveLength(0);
      expect(report.nonlinearities).toHaveLength(0);
      expect(report.selfOrganizationPatterns).toHaveLength(0);
    });

    it('should include timestamp and version in every report', () => {
      const snap = makeSnapshot();
      const report = detector.detectEmergence(snap);

      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.timestamp).toBeLessThanOrEqual(Date.now());
      expect(report.detectorVersion).toBe('0.2.0-phase5');
    });

    it('should handle single subsystem with no interactions', () => {
      const snap = makeSnapshot({
        subsystems: [sub('sole')],
        interactions: [],
      });
      const report = detector.detectEmergence(snap);

      // 单一子系统无交互 → 密度为0，无涌现
      expect(report.detected).toBe(T_FALSE);
    });
  });

  // ─── 交互密度分析 ─────────────────────────────────────────

  describe('interaction density analysis', () => {
    it('should return T_FALSE for sparse system (density < 1.5)', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a'), sub('b'), sub('c'), sub('d'),
        ],
        interactions: [
          ix('a', 'b'),
        ],
      });
      // density = 1/4 = 0.25
      const report = detector.detectEmergence(snap);
      expect(report.detected).toBe(T_FALSE);
    });

    it('should detect moderate density (1.5 ≤ density < 3.0)', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a'), sub('b'), sub('c'), sub('d'),
        ],
        interactions: [
          ix('a', 'b'),
          ix('b', 'c'),
          ix('c', 'd'),
          ix('d', 'a'),
          ix('a', 'c'),
          ix('b', 'd'),
        ],
      });
      // density = 6/4 = 1.5
      const report = detector.detectEmergence(snap);

      const densityBehavior = report.emergentBehaviors.find(
        (b) => b.description.includes('中等交互密度'),
      );
      expect(densityBehavior).toBeDefined();
      expect(densityBehavior!.intensity).toBe(0.3);
    });

    it('should detect high density (density ≥ 3.0)', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a'), sub('b'), sub('c'),
        ],
        interactions: [
          ix('a', 'b'), ix('a', 'c'),
          ix('b', 'a'), ix('b', 'c'),
          ix('c', 'a'), ix('c', 'b'),
          ix('a', 'b', { type: 'data' }),
          ix('b', 'c', { type: 'data' }),
          ix('c', 'a', { type: 'data' }),
        ],
      });
      // density = 9/3 = 3.0
      const report = detector.detectEmergence(snap);

      const highDensityBehavior = report.emergentBehaviors.find(
        (b) => b.description.includes('高交互密度涌现'),
      );
      expect(highDensityBehavior).toBeDefined();
      expect(highDensityBehavior!.intensity).toBeGreaterThan(0.3);
    });
  });

  // ─── 非线性检测 — 反馈回路 ────────────────────────────────

  describe('nonlinearity — feedback loops', () => {
    it('should detect bidirectional feedback loops', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b')],
        interactions: [
          ix('a', 'b', { frequency: 1.0 }),
          ix('b', 'a', { frequency: 0.8 }),
        ],
      });

      const report = detector.detectEmergence(snap);

      expect(report.nonlinearities.length).toBeGreaterThanOrEqual(1);
      const feedbackLoop = report.nonlinearities.find(
        (n) => n.description.includes('反馈回路'),
      );
      expect(feedbackLoop).toBeDefined();
      expect(feedbackLoop!.trigger).toContain('a');
      expect(feedbackLoop!.trigger).toContain('b');
      expect(feedbackLoop!.impact).toContain('循环依赖');
    });

    it('should not detect feedback loops when only one-way', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b')],
        interactions: [ix('a', 'b')],
      });

      const report = detector.detectEmergence(snap);

      const feedbackLoop = report.nonlinearities.find(
        (n) => n.description.includes('反馈回路'),
      );
      expect(feedbackLoop).toBeUndefined();
    });
  });

  // ─── 非线性检测 — 枢纽结构 ────────────────────────────────

  describe('nonlinearity — hub structures', () => {
    it('should detect hub when 3+ subsystems connect to same target', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a'), sub('b'), sub('c'), sub('hub'),
        ],
        interactions: [
          ix('a', 'hub'),
          ix('b', 'hub'),
          ix('c', 'hub'),
        ],
      });

      const report = detector.detectEmergence(snap);

      const hub = report.nonlinearities.find(
        (n) => n.description.includes('枢纽结构'),
      );
      expect(hub).toBeDefined();
      expect(hub!.trigger).toContain('hub');
      expect(hub!.impact).toContain('级联');
    });

    it('should not detect hub when only 2 subsystems connect', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b'), sub('target')],
        interactions: [
          ix('a', 'target'),
          ix('b', 'target'),
        ],
      });

      const report = detector.detectEmergence(snap);

      const hub = report.nonlinearities.find(
        (n) => n.description.includes('枢纽结构'),
      );
      expect(hub).toBeUndefined();
    });
  });

  // ─── 非线性检测 — 负载集中 ────────────────────────────────

  describe('nonlinearity — load concentration', () => {
    it('should detect high-load hub subsystem', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('critical', { load: 0.9 }),
          sub('a', { dependencies: ['critical'] }),
          sub('b', { dependencies: ['critical'] }),
          sub('c', { dependencies: ['critical'] }),
          sub('d', { dependencies: [] }),
        ],
        interactions: [
          ix('a', 'critical'), ix('b', 'critical'), ix('c', 'critical'),
        ],
      });

      const report = detector.detectEmergence(snap);

      const loadConcentration = report.nonlinearities.find(
        (n) => n.description.includes('负载集中'),
      );
      expect(loadConcentration).toBeDefined();
      expect(loadConcentration!.trigger).toContain('critical');
      expect(loadConcentration!.description).toContain('0.90');
    });

    it('should not flag normal-load subsystem', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('normal', { load: 0.5 }),
          sub('a', { dependencies: ['normal'] }),
          sub('b', { dependencies: ['normal'] }),
          sub('c', { dependencies: ['normal'] }),
        ],
        interactions: [
          ix('a', 'normal'), ix('b', 'normal'), ix('c', 'normal'),
        ],
      });

      const report = detector.detectEmergence(snap);

      const loadConcentration = report.nonlinearities.find(
        (n) => n.description.includes('负载集中'),
      );
      expect(loadConcentration).toBeUndefined();
    });
  });

  // ─── 非线性检测 — 高频低质交互 ────────────────────────────

  describe('nonlinearity — high-frequency low-quality', () => {
    it('should detect high-frequency but low-quality interactions', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b')],
        interactions: [
          ix('a', 'b', { frequency: 3.0, quality: T_FALSE }),
        ],
      });

      const report = detector.detectEmergence(snap);

      const lowQuality = report.nonlinearities.find(
        (n) => n.description.includes('低质高频'),
      );
      expect(lowQuality).toBeDefined();
      expect(lowQuality!.trigger).toContain('a');
      expect(lowQuality!.trigger).toContain('b');
      expect(lowQuality!.impact).toContain('蝴蝶效应');
    });
  });

  // ─── 涌现行为 — 不可归因属性 ──────────────────────────────

  describe('emergent behavior — unattributable properties', () => {
    it('should detect properties not attributable to any subsystem', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b')],
        interactions: [ix('a', 'b')],
        emergentProperties: ['collective_intelligence', 'self_healing'],
      });

      const report = detector.detectEmergence(snap);

      const unattr = report.emergentBehaviors.filter(
        (b) => b.description.includes('无法归因'),
      );
      expect(unattr.length).toBeGreaterThanOrEqual(1);
      expect(unattr[0].type).toBe('desirable');
      expect(unattr[0].intensity).toBe(0.5);
    });

    it('should detect attributable properties as low-intensity', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('collective_intelligence', { metadata: {} }),
          sub('b'),
        ],
        interactions: [ix('collective_intelligence', 'b')],
        emergentProperties: ['collective_intelligence'],
      });

      const report = detector.detectEmergence(snap);

      const attr = report.emergentBehaviors.find(
        (b) => b.description.includes('可归因'),
      );
      expect(attr).toBeDefined();
      expect(attr!.intensity).toBe(0.2);
    });
  });

  // ─── 涌现行为 — 非线性级联 ────────────────────────────────

  describe('emergent behavior — nonlinear cascade', () => {
    it('should detect cascade when multiple nonlinearities present', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a'), sub('b'), sub('c'), sub('d'),
        ],
        interactions: [
          // feedback loop: a ↔ b
          ix('a', 'b'), ix('b', 'a'),
          // hub: c, d → b
          ix('c', 'b'), ix('d', 'b'),
        ],
      });

      const report = detector.detectEmergence(snap);
      // Should have: feedback loop + hub structure = 2 nonlinearities
      expect(report.nonlinearities.length).toBeGreaterThanOrEqual(2);

      const cascade = report.emergentBehaviors.find(
        (b) => b.description.includes('非线性级联'),
      );
      expect(cascade).toBeDefined();
      expect(cascade!.type).toBe('undesirable');
    });
  });

  // ─── 自组织模式 — 自引用 ──────────────────────────────────

  describe('self-organization — self-reference', () => {
    it('should detect subsystems that depend on themselves', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('recursive', { dependencies: ['recursive'] }),
          sub('b'),
        ],
        interactions: [ix('recursive', 'b')],
      });

      const report = detector.detectEmergence(snap);

      expect(report.selfOrganizationPatterns.length).toBeGreaterThanOrEqual(1);
      const selfRef = report.selfOrganizationPatterns.find(
        (p) => p.includes('自引用依赖'),
      );
      expect(selfRef).toBeDefined();
      expect(selfRef).toContain('recursive');
    });
  });

  // ─── 自组织模式 — 互依赖簇 ────────────────────────────────

  describe('self-organization — mutual dependency clusters', () => {
    it('should detect mutual dependency clusters', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('alpha', { dependencies: ['beta'] }),
          sub('beta', { dependencies: ['alpha'] }),
          sub('gamma', { dependencies: ['delta'] }),
          sub('delta', { dependencies: ['gamma'] }),
        ],
        interactions: [
          ix('alpha', 'beta'), ix('beta', 'alpha'),
          ix('gamma', 'delta'), ix('delta', 'gamma'),
        ],
      });

      const report = detector.detectEmergence(snap);

      const cluster = report.selfOrganizationPatterns.find(
        (p) => p.includes('涌现依赖簇'),
      );
      expect(cluster).toBeDefined();
      expect(cluster).toMatch(/alpha.*beta|beta.*alpha/);
    });

    it('should not detect cluster when dependency is one-way', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('alpha', { dependencies: ['beta'] }),
          sub('beta', { dependencies: [] }),
        ],
        interactions: [ix('alpha', 'beta')],
      });

      const report = detector.detectEmergence(snap);

      const cluster = report.selfOrganizationPatterns.find(
        (p) => p.includes('涌现依赖簇'),
      );
      expect(cluster).toBeUndefined();
    });
  });

  // ─── 自组织模式 — 高频边界渗透 ───────────────────────────

  describe('self-organization — high-frequency boundary crossing', () => {
    it('should detect high-frequency interaction types crossing boundaries', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b'), sub('c')],
        interactions: [
          ix('a', 'b', { frequency: 3.0, type: 'bypass' }),
          ix('b', 'c', { frequency: 2.5, type: 'bypass' }),
        ],
      });

      const report = detector.detectEmergence(snap);

      const boundaryCross = report.selfOrganizationPatterns.find(
        (p) => p.includes('高频跨边界'),
      );
      expect(boundaryCross).toBeDefined();
      expect(boundaryCross).toContain('bypass');
    });
  });

  // ─── 综合判定 ─────────────────────────────────────────────

  describe('synthesis — combined scenarios', () => {
    it('should return T_TRUE when multiple strong indicators present', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('a', { load: 0.9 }),
          sub('b'),
          sub('c'),
          sub('d'),
        ],
        interactions: [
          // feedback loop: a ↔ b
          ix('a', 'b'), ix('b', 'a'),
          // hub: c, d → a (also load concentrated)
          ix('c', 'a'), ix('d', 'a'),
          // extra density
          ix('b', 'c'), ix('a', 'd'),
          // high frequency low quality
          ix('c', 'd', { frequency: 3.0, quality: T_FALSE }),
        ],
        emergentProperties: ['unexpected_synergy'],
      });

      const report = detector.detectEmergence(snap);

      // Should detect significant emergence
      expect(report.detected).toBe(T_TRUE);
      expect(report.nonlinearities.length).toBeGreaterThanOrEqual(2);
      expect(report.emergentBehaviors.length).toBeGreaterThanOrEqual(1);
    });

    it('should return T_UNKNOWN for borderline cases', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b'), sub('c')],
        interactions: [
          ix('a', 'b'), ix('b', 'c'), ix('c', 'a'),
        ],
        emergentProperties: ['mild_emergence'],
      });

      const report = detector.detectEmergence(snap);

      // One mild signal → should be UNKNOWN not FALSE
      // With an unattributable property (score=2 from emergentBehavior), it should be T_UNKNOWN at minimum
      expect([T_UNKNOWN, T_TRUE]).toContain(report.detected);
    });

    it('should return T_FALSE for simple linear system', () => {
      const snap = makeSnapshot({
        subsystems: [sub('a'), sub('b')],
        interactions: [ix('a', 'b')],
      });

      const report = detector.detectEmergence(snap);

      expect(report.detected).toBe(T_FALSE);
    });
  });

  // ─── 复杂涌现场景 ─────────────────────────────────────────

  describe('complex emergence scenarios', () => {
    it('should handle OCGS-like complex system', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('ecosystem-sensor', { load: 0.7 }),
          sub('system-model', { load: 0.5 }),
          sub('emergence-detector', { load: 0.3 }),
          sub('adaptive-regulator', { load: 0.4 }),
          sub('orchestrator', { load: 0.8 }),
        ],
        interactions: [
          ix('ecosystem-sensor', 'system-model', { type: 'signal' }),
          ix('ecosystem-sensor', 'emergence-detector', { type: 'signal' }),
          ix('system-model', 'emergence-detector', { type: 'snapshot' }),
          ix('emergence-detector', 'adaptive-regulator', { type: 'report' }),
          ix('emergence-detector', 'orchestrator', { type: 'report' }),
          ix('adaptive-regulator', 'orchestrator', { type: 'directive' }),
          ix('adaptive-regulator', 'ecosystem-sensor', { type: 'feedback' }),
          ix('orchestrator', 'ecosystem-sensor', { type: 'control' }),
          ix('orchestrator', 'system-model', { type: 'control' }),
          ix('orchestrator', 'emergence-detector', { type: 'control' }),
          ix('orchestrator', 'adaptive-regulator', { type: 'control' }),
        ],
        emergentProperties: [
          'system_consciousness',
          'self_optimizing_topology',
        ],
        boundaries: {
          hard: ['orchestrator_control'],
          soft: ['signal', 'snapshot', 'report'],
          fuzzy: ['feedback'],
        },
      });

      const report = detector.detectEmergence(snap);

      // A complex OCGS system should show significant emergence signals
      // density = 11/5 = 2.2 (moderate)
      expect(report.emergentBehaviors.length).toBeGreaterThanOrEqual(1);
      expect(report.detectorVersion).toBe('0.2.0-phase5');
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('should detect self-organization in recursive architecture', () => {
      const snap = makeSnapshot({
        subsystems: [
          sub('meta-cognition', {
            dependencies: ['meta-cognition', 'perception'],
            load: 0.6,
          }),
          sub('perception', {
            dependencies: ['meta-cognition'],
            load: 0.5,
          }),
        ],
        interactions: [
          ix('meta-cognition', 'perception', { type: 'query' }),
          ix('perception', 'meta-cognition', { type: 'response' }),
          ix('meta-cognition', 'meta-cognition', {
            type: 'introspect',
            frequency: 2.0,
          }),
          ix('perception', 'meta-cognition', {
            type: 'introspect',
            frequency: 2.5,
          }),
        ],
      });

      const report = detector.detectEmergence(snap);

      // Should detect self-referencing
      expect(report.selfOrganizationPatterns.length).toBeGreaterThanOrEqual(1);

      // Should detect feedback loop
      const feedbackLoop = report.nonlinearities.find(
        (n) => n.description.includes('反馈回路'),
      );
      expect(feedbackLoop).toBeDefined();

      // Should detect high-frequency boundary crossing
      const boundaryCross = report.selfOrganizationPatterns.find(
        (p) => p.includes('高频跨边界'),
      );
      expect(boundaryCross).toBeDefined();
      expect(boundaryCross).toContain('introspect');
    });
  });
});
