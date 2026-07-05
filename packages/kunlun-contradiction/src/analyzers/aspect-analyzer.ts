/**
 * 2. 矛盾方面分析器 (Aspect Analyzer)
 *
 * 分析矛盾每一方面的特性和力量：
 *   - 正题：力量评分、证据支撑度、逻辑自洽性、发展势头
 *   - 反题：同上
 *   - 综合判定：哪一方占优
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  AspectAnalysis,
  Proposition,
  Evidence,
} from '../types';

export interface AspectAnalyzer {
  analyze(contradiction: ContradictionPair): AspectAnalysis;
}

export function createAspectAnalyzer(): AspectAnalyzer {
  return new AspectAnalyzerImpl();
}

class AspectAnalyzerImpl implements AspectAnalyzer {
  analyze(contradiction: ContradictionPair): AspectAnalysis {
    const thesis = this.analyzeProposition(contradiction.thesis);
    const antithesis = this.analyzeProposition(contradiction.antithesis);

    // 综合判定
    const thesisScore = thesis.strength * 0.35 +
      thesis.evidenceSupport * 0.25 +
      thesis.internalConsistency * 0.25 +
      (thesis.momentum === 1 ? 0.15 : thesis.momentum === 0 ? 0.08 : 0);

    const antithesisScore = antithesis.strength * 0.35 +
      antithesis.evidenceSupport * 0.25 +
      antithesis.internalConsistency * 0.25 +
      (antithesis.momentum === 1 ? 0.15 : antithesis.momentum === 0 ? 0.08 : 0);

    const diff = thesisScore - antithesisScore;
    let overallBalance: Trit;
    if (diff > 0.15) overallBalance = 1;
    else if (diff < -0.15) overallBalance = -1;
    else overallBalance = 0;

    const trendPrediction = this.predictTrend(thesis, antithesis);

    return {
      contradictionId: contradiction.id,
      thesis,
      antithesis,
      overallBalance,
      trendPrediction,
    };
  }

  private analyzeProposition(p: Proposition): AspectAnalysis['thesis'] {
    // 力量评分：综合信度 + 证据强度
    const strength = this.calculateStrength(p);

    // 证据支撑度
    const evidenceSupport = this.calculateEvidenceSupport(p.evidence);

    // 逻辑自洽性
    const internalConsistency = this.calculateConsistency(p);

    // 发展势头：基于证据的时间趋势
    const momentum = this.calculateMomentum(p.evidence);

    // 关键支撑点：最强证据的内容
    const keyPillars = this.extractKeyPillars(p.evidence);

    return {
      strength: Math.round(strength * 100) / 100,
      evidenceSupport: Math.round(evidenceSupport * 100) / 100,
      internalConsistency: Math.round(internalConsistency * 100) / 100,
      momentum,
      keyPillars,
    };
  }

  private calculateStrength(p: Proposition): number {
    const evidenceAvg = p.evidence.length > 0
      ? p.evidence.reduce((sum, e) => sum + Math.max(0, e.strength), 0) / p.evidence.length
      : 0;
    const counterEvidenceAvg = p.counterEvidence.length > 0
      ? p.counterEvidence.reduce((sum, e) => sum + Math.max(0, e.strength), 0) / p.counterEvidence.length
      : 0;

    const rawStrength = (p.confidenceTrit + 1) / 2; // -1→0, 0→0.5, 1→1
    const adjustedStrength = rawStrength * 0.4 + evidenceAvg * 0.4 - counterEvidenceAvg * 0.2;

    return Math.max(0, Math.min(1, adjustedStrength));
  }

  private calculateEvidenceSupport(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    let supportCount = 0;
    let totalStrength = 0;
    for (const e of evidence) {
      if (e.strength === 1) {
        supportCount++;
        totalStrength += 1;
      } else if (e.strength === 0) {
        totalStrength += 0.3;
      }
    }

    return totalStrength / evidence.length;
  }

  private calculateConsistency(p: Proposition): number {
    // 检查命题与证据是否一致
    if (p.evidence.length === 0) return 0.5; // 无证据时中等

    const consistentCount = p.evidence.filter(e => e.strength !== -1).length;
    const baseConsistency = consistentCount / p.evidence.length;

    // 信度与证据一致性加分
    const evidenceTritAvg = p.evidence.reduce((sum, e) => sum + e.strength, 0) / p.evidence.length;
    const tritConsistency = 1 - Math.abs(p.confidenceTrit - evidenceTritAvg) / 2;

    return (baseConsistency + tritConsistency) / 2;
  }

  private calculateMomentum(evidence: Evidence[]): Trit {
    if (evidence.length < 2) return 0;

    // 按时间排序
    const sorted = [...evidence].sort((a, b) => a.timestamp - b.timestamp);

    // 比较最早和最新的证据强度趋势
    const early = sorted.slice(0, Math.ceil(sorted.length / 2));
    const late = sorted.slice(Math.ceil(sorted.length / 2));

    const earlyAvg = early.reduce((sum, e) => sum + e.strength, 0) / early.length;
    const lateAvg = late.reduce((sum, e) => sum + e.strength, 0) / late.length;

    const diff = lateAvg - earlyAvg;
    if (diff > 0.3) return 1;   // 增强趋势
    if (diff < -0.3) return -1;  // 减弱趋势
    return 0;                     // 稳定
  }

  private extractKeyPillars(evidence: Evidence[]): string[] {
    return evidence
      .filter(e => e.strength === 1)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3)
      .map(e => e.content);
  }

  private predictTrend(
    thesis: AspectAnalysis['thesis'],
    antithesis: AspectAnalysis['antithesis']
  ): string {
    const thesisTrend = thesis.momentum;
    const antithesisTrend = antithesis.momentum;

    if (thesisTrend === 1 && antithesisTrend === -1) {
      return '正题力量增强且反题力量减弱，正题有持续占优趋势';
    } else if (thesisTrend === -1 && antithesisTrend === 1) {
      return '反题力量增强且正题力量减弱，反题有持续占优趋势';
    } else if (thesisTrend === 1 && antithesisTrend === 1) {
      return '双方力量均在增强，矛盾可能加剧';
    } else if (thesisTrend === -1 && antithesisTrend === -1) {
      return '双方力量均在减弱，矛盾可能转化或消解';
    } else if (thesisTrend === 0 && antithesisTrend === 0) {
      return '双方力量稳定，僵持状态延续';
    }
    return '趋势不明朗，需进一步观察';
  }
}
