import { describe, it, expect, beforeEach } from 'vitest';
import { MetaSynthesisEngine, MetaSynthesisWorkshop } from '../src/index.js';
import type { SynthesisParticipant, QualitativeResult } from '../src/index.js';
import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

function makeParticipant(id: string, type: SynthesisParticipant['type'] = 'pi-agent'): SynthesisParticipant {
  return { id, name: `Agent-${id}`, type };
}

describe('MetaSynthesisEngine', () => {
  let engine: MetaSynthesisEngine;
  const participants: SynthesisParticipant[] = [
    makeParticipant('a1', 'pi-agent'),
    makeParticipant('a2', 'llm'),
    makeParticipant('a3', 'human'),
  ];

  beforeEach(() => {
    engine = new MetaSynthesisEngine();
  });

  it('should produce qualitative judgment for each participant', () => {
    const results = engine.qualitativeJudgment('test problem', participants);
    expect(results).toHaveLength(3);
    expect(results[0]!.participantId).toBe('a1');
    expect(results[0]!.stance).toBe(T_UNKNOWN);
    expect(results[0]!.confidence).toBe(0.5);
  });

  it('should produce quantitative analysis from qualitative results', () => {
    const qualitative: QualitativeResult[] = [
      { participantId: 'a1', stance: T_TRUE as Trit, reasoning: 'pro', confidence: 0.8 },
      { participantId: 'a2', stance: T_FALSE as Trit, reasoning: 'con', confidence: 0.6 },
      { participantId: 'a3', stance: T_UNKNOWN, reasoning: 'neutral', confidence: 0.4 },
    ];
    const quantitative = engine.quantitativeAnalysis(qualitative);
    expect(quantitative).toHaveLength(3);
    expect(quantitative[0]!.consensusRatio).toBeCloseTo(2/3);
  });

  it('should integrate qualitative and quantitative into synthesis result', () => {
    const qualitative: QualitativeResult[] = [
      { participantId: 'a1', stance: T_TRUE as Trit, reasoning: 'pro', confidence: 0.9 },
      { participantId: 'a2', stance: T_TRUE as Trit, reasoning: 'also pro', confidence: 0.7 },
    ];
    const quantitative = engine.quantitativeAnalysis(qualitative);
    const result = engine.integrate(qualitative, quantitative);
    expect(result.consensus.stance).toBe(T_TRUE);
    expect(result.disagreements).toHaveLength(0);
    expect(result.overallConfidence).toBeGreaterThan(0);
  });

  it('should handle empty qualitative results', () => {
    const result = engine.integrate([], []);
    expect(result.consensus.stance).toBe(T_UNKNOWN);
    expect(result.consensus.confidence).toBe(0);
    expect(result.overallConfidence).toBe(0);
  });

  it('should detect disagreements', () => {
    const analyzed: QualitativeResult[] = [
      { participantId: 'a1', stance: T_TRUE as Trit, reasoning: 'pro', confidence: 0.8 },
      { participantId: 'a2', stance: T_FALSE as Trit, reasoning: 'con', confidence: 0.7 },
      { participantId: 'a3', stance: T_TRUE as Trit, reasoning: 'also pro', confidence: 0.9 },
    ];
    const disagreements = engine.detectDisagreements(analyzed);
    // dominant stance: avg of (1, -1, 1) = 1/3 ≈ 0.33 → clampToTrit(0.33) = 0 (T_UNKNOWN)
    // So disagreements are those not T_UNKNOWN: a1 and a2 and a3
    // Actually avg = 1/3 ≈ 0.33, clampToTrit(0.33): 0.33 < 0.5, 0.33 > -0.5 → T_UNKNOWN
    // So all non-UNKNOWN are disagreements
    expect(disagreements).toHaveLength(3);
  });

  it('should form consensus from unanimous agreement', () => {
    const analyzed: QualitativeResult[] = [
      { participantId: 'a1', stance: T_TRUE as Trit, reasoning: 'pro', confidence: 0.9 },
      { participantId: 'a2', stance: T_TRUE as Trit, reasoning: 'pro', confidence: 0.8 },
    ];
    const consensus = engine.formConsensus(analyzed);
    expect(consensus.stance).toBe(T_TRUE);
    expect(consensus.supportingIds).toContain('a1');
    expect(consensus.supportingIds).toContain('a2');
  });

  it('should form consensus with empty input', () => {
    const consensus = engine.formConsensus([]);
    expect(consensus.stance).toBe(T_UNKNOWN);
    expect(consensus.confidence).toBe(0);
    expect(consensus.supportingIds).toHaveLength(0);
  });

  it('should run full synthesize flow', async () => {
    const result = await engine.synthesize('test problem', participants);
    expect(result.consensus).toBeDefined();
    expect(result.overallConfidence).toBeDefined();
    expect(result.disagreements).toBeDefined();
  });
});

describe('MetaSynthesisWorkshop', () => {
  const participants: SynthesisParticipant[] = [
    makeParticipant('w1', 'pi-agent'),
    makeParticipant('w2', 'llm'),
  ];
  let workshop: MetaSynthesisWorkshop;

  beforeEach(() => {
    workshop = new MetaSynthesisWorkshop(participants);
  });

  it('should discuss a proposition', () => {
    const opinions = workshop.discuss('Should we adopt spiral model?');
    expect(opinions).toHaveLength(2);
    expect(opinions[0]!.participantId).toBe('w1');
  });

  it('should collect opinions after discussion', () => {
    workshop.discuss('test');
    const opinions = workshop.collectOpinions();
    expect(opinions).toHaveLength(2);
  });

  it('should produce rebuttals', () => {
    workshop.discuss('test');
    const rebuttals = workshop.rebuttal();
    expect(rebuttals).toHaveLength(2);
    // rebuttals negate original stance
    expect(rebuttals[0]!.stance).toBe(-0); // T_UNKNOWN * -1 = 0 (since 0 * -1 = 0)
  });

  it('should converge to a synthesis result', async () => {
    workshop.discuss('test proposition');
    workshop.rebuttal();
    const result = await workshop.converge();
    expect(result.consensus).toBeDefined();
    expect(result.overallConfidence).toBeDefined();
  });

  it('should return participants', () => {
    const pts = workshop.getParticipants();
    expect(pts).toHaveLength(2);
  });

  it('should return current proposition', () => {
    workshop.discuss('my proposition');
    expect(workshop.getProposition()).toBe('my proposition');
  });

  it('should reset workshop state', () => {
    workshop.discuss('test');
    workshop.reset();
    expect(workshop.getProposition()).toBe('');
    expect(workshop.collectOpinions()).toHaveLength(0);
  });
});
