/**
 * MetaSynthesisEngine — 大成智慧学综合集成引擎
 *
 * 定性判断 → 定量分析 → 综合集成 → 共识形成
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE, TritMath, clampToTrit } from '@kunlun/ternary';
import type {
  SynthesisParticipant,
  QualitativeResult,
  QuantitativeResult,
  SynthesisResult,
  UnifiedConclusion,
} from './types.js';

export class MetaSynthesisEngine {
  /** 综合集成全流程 */
  async synthesize(
    problem: string,
    participants: SynthesisParticipant[]
  ): Promise<SynthesisResult> {
    const qualitative = this.qualitativeJudgment(problem, participants);
    const quantitative = this.quantitativeAnalysis(qualitative);
    return this.integrate(qualitative, quantitative);
  }

  /** 定性判断：每个参与者给出立场 */
  qualitativeJudgment(
    problem: string,
    participants: SynthesisParticipant[]
  ): QualitativeResult[] {
    return participants.map(p => ({
      participantId: p.id,
      stance: T_UNKNOWN as Trit,
      reasoning: `Analysis of "${problem}" by ${p.name} (${p.type})`,
      confidence: 0.5,
    }));
  }

  /** 定量分析：将定性结果转换为定量指标 */
  quantitativeAnalysis(qualitative: QualitativeResult[]): QuantitativeResult[] {
    const total = qualitative.length;
    const trueCount = qualitative.filter(q => q.stance === T_TRUE).length;
    const falseCount = qualitative.filter(q => q.stance === T_FALSE).length;
    const unknownCount = qualitative.filter(q => q.stance === T_UNKNOWN).length;

    const consensusRatio = total > 0 ? (trueCount + falseCount) / total : 0;
    const avgConfidence = total > 0
      ? qualitative.reduce((sum, q) => sum + q.confidence, 0) / total
      : 0;

    const dominantStance = clampToTrit(
      qualitative.reduce((sum, q) => sum + q.stance, 0) / (total || 1)
    );

    return qualitative.map(q => ({
      proposition: q.reasoning,
      confidence: q.confidence,
      evidenceStrength: q.confidence * (q.stance !== T_UNKNOWN ? 1 : 0.3),
      consensusRatio,
    }));
  }

  /** 综合集成：定性与定量相结合 */
  integrate(
    qualitative: QualitativeResult[],
    quantitative: QuantitativeResult[]
  ): SynthesisResult {
    const total = qualitative.length;
    if (total === 0) {
      return {
        consensus: { stance: T_UNKNOWN, confidence: 0, supportingIds: [] },
        disagreements: [],
        overallConfidence: 0,
      };
    }

    const stanceSum = qualitative.reduce((sum, q) => sum + q.stance, 0);
    const consensusStance = clampToTrit(stanceSum / total);
    const avgConfidence = qualitative.reduce((sum, q) => sum + q.confidence, 0) / total;
    const avgEvidence = quantitative.reduce((sum, q) => sum + q.evidenceStrength, 0) / total;
    const overallConfidence = (avgConfidence + avgEvidence) / 2;

    const supportingIds = qualitative
      .filter(q => q.stance === consensusStance)
      .map(q => q.participantId);

    const disagreements = qualitative.filter(q => q.stance !== consensusStance);

    return {
      consensus: {
        stance: consensusStance,
        confidence: avgConfidence,
        supportingIds,
      },
      disagreements,
      overallConfidence,
    };
  }

  /** 检测分歧 */
  detectDisagreements(analyzed: QualitativeResult[]): QualitativeResult[] {
    const stanceSum = analyzed.reduce((sum, q) => sum + q.stance, 0);
    const total = analyzed.length;
    const dominant = clampToTrit(stanceSum / (total || 1));
    return analyzed.filter(q => q.stance !== dominant);
  }

  /** 形成共识 */
  formConsensus(analyzed: QualitativeResult[]): UnifiedConclusion {
    const total = analyzed.length;
    if (total === 0) {
      return { stance: T_UNKNOWN, confidence: 0, supportingIds: [] };
    }

    const stanceSum = analyzed.reduce((sum, q) => sum + q.stance, 0);
    const stance = clampToTrit(stanceSum / total);
    const confidence = analyzed.reduce((sum, q) => sum + q.confidence, 0) / total;
    const supportingIds = analyzed
      .filter(q => q.stance === stance)
      .map(q => q.participantId);

    return { stance, confidence, supportingIds };
  }
}
