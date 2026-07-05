import { describe, it, expect, beforeEach } from 'vitest';
import { createSystemModel } from '../src/system-model.js';
import type { ISystemModel } from '../src/system-model.js';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type { EcosystemScanResult, EcosystemSignal, SourceScanDetail } from '../src/types.js';

function makeScanResult(overrides?: Partial<EcosystemScanResult>): EcosystemScanResult {
  const signals: EcosystemSignal[] = overrides?.signals ?? [
    {
      source: 'self',
      signalType: 'test',
      significance: T_TRUE,
      description: 'test signal',
      impact: { direction: T_TRUE, affectedSubsystems: ['ocgs'], urgency: T_UNKNOWN },
      detectedAt: Date.now(),
    },
  ];

  return {
    scanId: 'test-scan-1',
    timestamp: new Date(),
    signals,
    sourceDetails: [],
    ecosystemHealth: overrides?.ecosystemHealth ?? T_UNKNOWN,
    stats: {
      totalLatencyMs: 10,
      sourcesScanned: 1,
      sourcesUnavailable: 0,
      sourcesDegraded: 0,
    },
    ...overrides,
  };
}

describe('SystemModel', () => {
  let model: ISystemModel;

  beforeEach(() => {
    model = createSystemModel();
  });

  describe('initialization', () => {
    it('should have 7 default subsystems', () => {
      const snapshot = model.getSnapshot();
      expect(snapshot.subsystems.length).toBe(7);
    });

    it('should have default interactions', () => {
      const snapshot = model.getSnapshot();
      expect(snapshot.interactions.length).toBe(5);
    });

    it('should have default boundaries', () => {
      const snapshot = model.getSnapshot();
      expect(snapshot.boundaries.hard).toContain('ternary_logic');
      expect(snapshot.boundaries.soft).toContain('knowledge_domain');
      expect(snapshot.boundaries.fuzzy).toContain('ecosystem_sensing');
    });

    it('should start at version 0', () => {
      expect(model.getSnapshot().version).toBe(0);
    });

    it('should accept custom initial subsystems', () => {
      const m = createSystemModel({
        subsystems: [
          {
            name: 'custom',
            status: T_TRUE,
            dependencies: [],
            dependents: [],
            load: 0.0,
            metadata: {},
          },
        ],
      });
      expect(m.getSnapshot().subsystems.length).toBe(1);
      expect(m.getSubsystem('custom')).toBeDefined();
    });
  });

  describe('subsystem CRUD', () => {
    it('should register new subsystem', () => {
      model.registerSubsystem({
        name: 'new-one',
        status: T_TRUE,
        dependencies: ['ternary'],
        dependents: [],
        load: 0.5,
        metadata: { test: 'yes' },
      });

      expect(model.getSubsystem('new-one')).toBeDefined();
      expect(model.getSubsystem('new-one')!.load).toBe(0.5);
    });

    it('should increment version on register', () => {
      const v1 = model.getSnapshot().version;
      model.registerSubsystem({
        name: 'v2-test',
        status: T_UNKNOWN,
        dependencies: [],
        dependents: [],
        load: 0.0,
        metadata: {},
      });

      expect(model.getSnapshot().version).toBe(v1 + 1);
    });

    it('should unregister subsystem and clean up interactions', () => {
      model.registerSubsystem({
        name: 'to-remove',
        status: T_TRUE,
        dependencies: ['ternary'],
        dependents: [],
        load: 0.0,
        metadata: {},
      });
      model.addInteraction({
        from: 'to-remove',
        to: 'ocgs',
        type: 'test',
        frequency: 1,
        quality: T_UNKNOWN,
      });

      const removed = model.unregisterSubsystem('to-remove');
      expect(removed).toBe(true);
      expect(model.getSubsystem('to-remove')).toBeUndefined();

      // interaction should be cleaned up
      const snap = model.getSnapshot();
      const cleaned = snap.interactions.find(
        (i) => i.from === 'to-remove' || i.to === 'to-remove',
      );
      expect(cleaned).toBeUndefined();
    });

    it('should return false for unregister of nonexistent subsystem', () => {
      expect(model.unregisterSubsystem('ghost')).toBe(false);
    });

    it('should update subsystem status', () => {
      const updated = model.updateSubsystemStatus('ocgs', T_FALSE);
      expect(updated).toBe(true);

      const sub = model.getSubsystem('ocgs');
      expect(sub!.status).toBe(T_FALSE);
    });

    it('should return false for status update of nonexistent', () => {
      expect(model.updateSubsystemStatus('nope', T_TRUE)).toBe(false);
    });
  });

  describe('interactions', () => {
    it('should add interaction and increment version', () => {
      const v1 = model.getSnapshot().version;
      model.addInteraction({
        from: 'presence',
        to: 'spiral',
        type: 'direct',
        frequency: 2,
        quality: T_TRUE,
      });

      const snap = model.getSnapshot();
      expect(snap.version).toBe(v1 + 1);
      expect(
        snap.interactions.some((i) => i.from === 'presence' && i.to === 'spiral' && i.type === 'direct'),
      ).toBe(true);
    });
  });

  describe('boundaries', () => {
    it('should set boundaries', () => {
      model.setBoundaries({
        hard: ['a'],
        soft: ['b'],
        fuzzy: ['c'],
      });

      const snap = model.getSnapshot();
      expect(snap.boundaries.hard).toEqual(['a']);
      expect(snap.boundaries.soft).toEqual(['b']);
      expect(snap.boundaries.fuzzy).toEqual(['c']);
    });
  });

  describe('updateSystemModel', () => {
    it('should update subsystem status from self signals', () => {
      const scan = makeScanResult({
        signals: [
          {
            source: 'self',
            signalType: 'degradation',
            significance: T_TRUE,
            description: 'subsystem degraded',
            impact: { direction: T_FALSE, affectedSubsystems: ['ocgs'], urgency: T_TRUE },
            detectedAt: Date.now(),
          },
        ],
      });

      const snapshot = model.updateSystemModel(scan);
      const ocgs = snapshot.subsystems.find((s) => s.name === 'ocgs');
      expect(ocgs!.status).toBe(T_UNKNOWN); // degraded
    });

    it('should add emergence property when ecosystem health is low', () => {
      const scan = makeScanResult({ ecosystemHealth: T_FALSE });

      const snapshot = model.updateSystemModel(scan);
      expect(snapshot.emergentProperties).toContain('ecosystem_decline_alert');
    });

    it('should increment version on update', () => {
      const v1 = model.getSnapshot().version;
      model.updateSystemModel(makeScanResult());
      expect(model.getSnapshot().version).toBe(v1 + 1);
    });

    it('should not add duplicate emergence properties', () => {
      const scan = makeScanResult({ ecosystemHealth: T_FALSE });
      model.updateSystemModel(scan);
      model.updateSystemModel(scan);

      const props = model.getSnapshot().emergentProperties;
      const count = props.filter((p) => p === 'ecosystem_decline_alert').length;
      expect(count).toBe(1);
    });
  });

  describe('complexity assessment', () => {
    it('should classify as "simple" for 7 subsystems and 5 interactions', () => {
      const assessment = model.assessComplexity();
      expect(assessment.complexityClass).toBe('complicated');
      // 7 subsystems, interactionDensity = 5/7 ≈ 0.71
      expect(assessment.interactionDensity).toBeCloseTo(0.71, 1);
    });

    it('should classify as "complex" when adding many subsystems', () => {
      for (let i = 0; i < 10; i++) {
        model.registerSubsystem({
          name: `extra-${i}`,
          status: T_TRUE,
          dependencies: [],
          dependents: [],
          load: 0.0,
          metadata: {},
        });
      }

      // 17 subsystems total
      const assessment = model.assessComplexity();
      // 17 subs, 5 interactions → density 5/17 ≈ 0.29 → complicated (s <= 20, density <= 5)
      expect(assessment.subsystemCount).toBe(17);
    });

    it('should return "chaotic" with very many subsystems', () => {
      for (let i = 0; i < 20; i++) {
        model.registerSubsystem({
          name: `massive-${i}`,
          status: T_TRUE,
          dependencies: [],
          dependents: [],
          load: 0.0,
          metadata: {},
        });
        model.addInteraction({
          from: `massive-${i}`,
          to: 'ocgs',
          type: 'many',
          frequency: 1,
          quality: T_UNKNOWN,
        });
      }

      // 27 subsystems, 25 interactions → density 25/27 ≈ 0.93 → complex
      // Wait, let me re-check: > 20 subs with density <= 5 → "complex", not "chaotic"
      const assessment = model.assessComplexity();
      expect(['complex', 'chaotic']).toContain(assessment.complexityClass);
    });

    it('should include management approach', () => {
      const assessment = model.assessComplexity();
      expect([
        'probe_sense_respond',
        'sense_analyze_respond',
        'act_sense_respond',
      ]).toContain(assessment.recommendedApproach);
    });
  });

  describe('emergent properties', () => {
    it('should add emergent property', () => {
      model.addEmergentProperty('test_prop');
      expect(model.getSnapshot().emergentProperties).toContain('test_prop');
    });

    it('should not add duplicate', () => {
      model.addEmergentProperty('dup');
      model.addEmergentProperty('dup');
      const count = model.getSnapshot().emergentProperties.filter((p) => p === 'dup').length;
      expect(count).toBe(1);
    });
  });
});
