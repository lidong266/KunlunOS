/**
 * PracticeSpiralEngine — 实践螺旋引擎
 *
 * 实现实践论核心算法：实践→认识→再实践→再认识四阶段无限螺旋。
 * 替代 V1 的 IEvolutionEngine（双速进化模型）。
 *
 * 关键差异：
 * 1. 不是「策略选择」，是「实践检验」
 * 2. 不是「AB测试」(随机对照)，是「投入实践→观察结果→提炼规律」
 * 3. 不是「优化Beta参数」，是「螺旋上升」
 * 4. 快慢之分被「实践-认识-再实践-再认识」的统一螺旋取代
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE, TRYTE_ZERO, tryteMerge, tryteCertainty } from '@kunlun/ternary';
import {
  type PracticeContext,
  type PracticeResult,
  type PracticeEnvironment,
  type CognitionOutput,
  type RePracticeResult,
  type DeepenedCognition,
  type SpiralCycleOutput,
  type SpiralPosition,
  type SpiralPhase,
  type SpiralPhaseData,
  type SpiralHistory,
  type SpiralHistoryEntry,
  type UnintendedConsequence,
  type PracticeMetric,
} from './types.js';

// ═══════════════════════════════════════════════════════════════
// 引擎接口
// ═══════════════════════════════════════════════════════════════

export interface IPracticeSpiralEngine {
  /** 阶段一：感知实践 — 将认知投入实践 */
  engagePractice(context: PracticeContext): Promise<PracticeResult>;

  /** 阶段二：理论认识 — 从实践中提炼规律 */
  deriveCognition(practice: PracticeResult): Promise<CognitionOutput>;

  /** 阶段三：验证再实践 — 将新认识投入验证 */
  reengagePractice(
    cognition: CognitionOutput,
    originalContext: PracticeContext,
  ): Promise<RePracticeResult>;

  /** 阶段四：深化再认识 — 螺旋上升的新认识 */
  deepenCognition(
    originalCognition: CognitionOutput,
    rePractice: RePracticeResult,
  ): Promise<DeepenedCognition>;

  /** 执行完整的一个螺旋周期 */
  iterateSpiral(context: PracticeContext): Promise<SpiralCycleOutput>;

  /** 每个阶段的 Trit 判定 */
  judgePhase(phase: SpiralPhase, data: SpiralPhaseData): Promise<Trit>;

  /** 获取当前螺旋位置 */
  getSpiralPosition(): SpiralPosition;

  /** 获取螺旋历史 */
  getSpiralHistory(): SpiralHistory;
}

// ═══════════════════════════════════════════════════════════════
// 引擎实现
// ═══════════════════════════════════════════════════════════════

export class PracticeSpiralEngine implements IPracticeSpiralEngine {
  private history: SpiralHistoryEntry[] = [];
  private cycleCount = 0;
  private currentPhase: SpiralPhase = 'practice';
  private currentDomain = '';

  // ─── 阶段一：engagePractice ───

  async engagePractice(context: PracticeContext): Promise<PracticeResult> {
    this.currentPhase = 'practice';
    this.currentDomain = context.domain;

    // 从 hypothesis 的证据链计算实践结果
    const hypothesis = context.hypothesis;
    const supportingEvidence = hypothesis.evidence ?? [];
    const counterEvidence: { strength: number }[] = []; // 实践中可能发现的反例

    // 基于证据计算确信度
    const totalSupport = supportingEvidence.reduce(
      (sum: number, e: { strength?: number }) => sum + (e.strength ?? 0.5),
      0,
    );
    const totalCounter = counterEvidence.reduce(
      (sum, e) => sum + (e.strength ?? 0.5),
      0,
    );

    const verdict = this.computeVerdict(
      totalSupport,
      totalCounter,
      context.environment.type,
      undefined,
    );

    // 提取涌现现象和意外后果
    const emergentObservations = this.extractEmergentObservations(
      hypothesis,
      context,
    );
    const metrics = this.computeMetrics(supportingEvidence.length, counterEvidence.length);
    const unintendedConsequences = this.detectUnintendedConsequences(
      hypothesis,
      verdict,
      context.environment,
    );

    return {
      verdict,
      emergentObservations,
      newContradictions: [], // 将在后续阶段由矛盾引擎注入
      metrics,
      unintendedConsequences,
    };
  }

  // ─── 阶段二：deriveCognition ───

  async deriveCognition(practice: PracticeResult): Promise<CognitionOutput> {
    this.currentPhase = 'cognition';

    const principles = this.distillPrinciples(practice);
    const universality = this.assessUniversality(practice);
    const confidenceVector = this.buildConfidenceVector(practice);

    return {
      principles,
      universality,
      theoreticalContradictions: [],
      confidenceVector,
    };
  }

  // ─── 阶段三：reengagePractice ───

  async reengagePractice(
    cognition: CognitionOutput,
    originalContext: PracticeContext,
  ): Promise<RePracticeResult> {
    this.currentPhase = 'rePractice';

    // 用新提炼的规律指导再实践
    const verification = this.verifyAgainstContext(cognition, originalContext);
    const refinedPractice = this.buildRefinedPractice(cognition, originalContext);

    return {
      verification,
      refinedPractice,
      newContradictions: [],
    };
  }

  // ─── 阶段四：deepenCognition ───

  async deepenCognition(
    originalCognition: CognitionOutput,
    rePractice: RePracticeResult,
  ): Promise<DeepenedCognition> {
    this.currentPhase = 'deepenCognition';

    const deepenedPrinciples = this.deepenPrinciples(
      originalCognition.principles,
      rePractice,
    );
    const spiralAscension = this.judgeAscension(
      originalCognition,
      rePractice,
    );
    const emergentProperties = this.extractEmergentProperties(
      originalCognition,
      rePractice,
    );
    const updatedConfidenceVector = this.updateConfidence(
      originalCognition.confidenceVector,
      rePractice.verification,
    );

    return {
      deepenedPrinciples,
      spiralAscension,
      emergentProperties,
      updatedConfidenceVector,
    };
  }

  // ─── 完整螺旋周期 ───

  async iterateSpiral(context: PracticeContext): Promise<SpiralCycleOutput> {
    this.cycleCount++;
    const cycleId = `spiral-${this.cycleCount}-${Date.now()}`;
    const startedAt = new Date();

    const practice = await this.engagePractice(context);
    const cognition: CognitionOutput = await this.deriveCognition(practice);
    const rePractice = await this.reengagePractice(cognition, context);
    const deepenedCognition = await this.deepenCognition(cognition, rePractice);

    const completedAt = new Date();

    const quality = this.evaluateQuality(practice, cognition, rePractice, deepenedCognition);
    const protractedWarImpact = this.assessPWImpact(deepenedCognition, quality);

    const entry: SpiralHistoryEntry = {
      cycleId,
      cycleNumber: this.cycleCount,
      domain: context.domain,
      startedAt,
      completedAt,
      ascension: deepenedCognition.spiralAscension,
    };
    this.history.push(entry);

    return {
      cycleId,
      cycleNumber: this.cycleCount,
      startedAt,
      completedAt,
      phases: { practice, cognition, rePractice, deepenedCognition },
      quality,
      protractedWarImpact,
    };
  }

  // ─── 阶段判定 ───

  async judgePhase(phase: SpiralPhase, data: SpiralPhaseData): Promise<Trit> {
    switch (phase) {
      case 'practice': {
        const d = data as PracticeResult;
        if (d.verdict === 1 && d.unintendedConsequences.length === 0) return T_TRUE;
        if (d.verdict === -1) return T_FALSE;
        return T_UNKNOWN;
      }
      case 'cognition': {
        const d = data as CognitionOutput;
        const certainty = tryteCertainty(d.confidenceVector);
        if (d.principles.length >= 2 && certainty >= 0.5) return T_TRUE;
        if (d.principles.length === 0) return T_FALSE;
        return T_UNKNOWN;
      }
      case 'rePractice': {
        const d = data as RePracticeResult;
        return d.verification;
      }
      case 'deepenCognition': {
        const d = data as DeepenedCognition;
        return d.spiralAscension;
      }
    }
  }

  // ─── 位置查询 ───

  getSpiralPosition(): SpiralPosition {
    return {
      currentPhase: this.currentPhase,
      cycleCount: this.cycleCount,
      totalAscensions: this.history.filter((h) => h.ascension === 1).length,
      currentDomain: this.currentDomain,
    };
  }

  getSpiralHistory(): SpiralHistory {
    return {
      entries: [...this.history],
      totalCycles: this.cycleCount,
      domains: [...new Set(this.history.map((h) => h.domain))],
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 私有算法
  // ═════════════════════════════════════════════════════════════

  private computeVerdict(
    support: number,
    counter: number,
    envType: string,
    hypothesisConfidence?: number,
  ): Trit {
    const total = support + counter;
    if (total === 0) return T_UNKNOWN;

    const ratio = support / total;

    // 生产环境要求更高的证据门槛
    const threshold = envType === 'production' ? 0.7 : 0.5;

    // 无对立证据时，绝对支持度也需达到门槛
    if (counter === 0 && support < threshold) return T_UNKNOWN;

    if (ratio >= threshold) return T_TRUE;
    if (ratio <= 1 - threshold) return T_FALSE;
    return T_UNKNOWN;
  }

  private extractEmergentObservations(
    hypothesis: { statement: string; confidence?: number },
    context: PracticeContext,
  ): string[] {
    const observations: string[] = [];
    if (context.environment.type === 'production') {
      observations.push(`在实践中观察到"${hypothesis.statement}"的实际效果`);
    }
    if (context.relatedContradictions.length > 0) {
      observations.push('观察到相关矛盾的互动效应');
    }
    return observations;
  }

  private computeMetrics(
    evidenceCount: number,
    counterCount: number,
  ): Record<string, PracticeMetric> {
    return {
      evidenceWeight: {
        before: 0,
        after: evidenceCount * 0.5,
        change: evidenceCount > 0 ? 1 : 0,
      },
      counterEvidence: {
        before: counterCount,
        after: counterCount,
        change: 0,
      },
    };
  }

  private detectUnintendedConsequences(
    hypothesis: { statement: string; confidence?: number },
    verdict: Trit,
    environment: PracticeEnvironment,
  ): UnintendedConsequence[] {
    const consequences: UnintendedConsequence[] = [];

    if (verdict === 1 && (hypothesis.confidence ?? 0.5) < 0.6) {
      consequences.push({
        description: `低信度假说"${hypothesis.statement}"意外被实践证实`,
        impact: 1,
      });
    }

    if (environment.type === 'production' && verdict === -1) {
      consequences.push({
        description: '生产环境实践证伪可能影响现有信任',
        impact: -1,
      });
    }

    return consequences;
  }

  // ─── 规律提炼 ───

  private distillPrinciples(practice: PracticeResult): string[] {
    const principles: string[] = [];
    if (practice.verdict === 1) {
      principles.push('假设在实践中得到证实，可提炼为可靠规律');
    }
    if (practice.emergentObservations.length > 0) {
      principles.push('实践中涌现了新现象，需要进一步观察');
    }
    if (practice.unintendedConsequences.length > 0) {
      const positive = practice.unintendedConsequences.filter((c) => c.impact === 1);
      const negative = practice.unintendedConsequences.filter((c) => c.impact === -1);
      if (positive.length > negative.length) {
        principles.push('意外后果偏向正面，可纳入新认知');
      } else if (negative.length > 0) {
        principles.push('意外后果偏向负面，需修正原有假设');
      }
    }
    return principles;
  }

  private assessUniversality(practice: PracticeResult): Trit {
    if (practice.verdict === 1 && practice.unintendedConsequences.length === 0) {
      return T_TRUE;
    }
    if (practice.verdict === -1) return T_FALSE;
    return T_UNKNOWN;
  }

  private buildConfidenceVector(practice: PracticeResult): Tryte {
    // 六维信度：[实践验证, 证据支撑, 逻辑自洽, 可重复性, 涌现支持, 意外减少]
    const vec: Tryte = [0, 0, 0, 0, 0, 0];
    if (practice.verdict === 1) {
      vec[0] = 1;
      vec[3] = 1;
    } else if (practice.verdict === -1) {
      vec[0] = -1;
      vec[3] = -1;
    }
    // 证据支撑：至少有一些则置正
    const evidenceCount = Object.keys(practice.metrics).length;
    vec[1] = evidenceCount > 0 ? 1 : 0;
    // 涌现支持
    vec[4] = practice.emergentObservations.length > 0 ? 1 : 0;
    // 意外减少
    const negativeConsequences = practice.unintendedConsequences.filter(
      (c) => c.impact === -1,
    ).length;
    vec[5] = negativeConsequences === 0 ? 1 : negativeConsequences <= 2 ? 0 : -1;
    return vec;
  }

  // ─── 再实践验证 ───

  private verifyAgainstContext(
    cognition: CognitionOutput,
    context: PracticeContext,
  ): Trit {
    const principlesCount = cognition.principles.length;
    const universality = cognition.universality;

    if (principlesCount >= 2 && universality === 1) return T_TRUE;
    if (principlesCount === 0) return T_FALSE;
    return T_UNKNOWN;
  }

  private buildRefinedPractice(
    cognition: CognitionOutput,
    context: PracticeContext,
  ): string {
    const domain = context.domain || '未知领域';
    const principleSummary = cognition.principles.join('；');
    return `在${domain}中，基于提炼规律"${principleSummary}"修正后的再实践方案`;
  }

  // ─── 深化认识 ───

  private deepenPrinciples(
    originalPrinciples: string[],
    rePractice: RePracticeResult,
  ): string[] {
    const deepened = [...originalPrinciples];
    if (rePractice.verification === 1) {
      deepened.push('[深化] 再实践确认了原有规律的稳定性');
    } else if (rePractice.verification === -1) {
      deepened.push('[修正] 再实践否定原有规律，需重新提炼');
    } else {
      deepened.push('[存疑] 再实践未能确认，需更多数据');
    }
    deepened.push(`修正后的实践方案：${rePractice.refinedPractice}`);
    return deepened;
  }

  private judgeAscension(
    originalCognition: CognitionOutput,
    rePractice: RePracticeResult,
  ): Trit {
    const origCertainty = tryteCertainty(originalCognition.confidenceVector);

    if (rePractice.verification === 1 && origCertainty >= 0.5) return T_TRUE;
    if (rePractice.verification === -1 && origCertainty < 0.3) return T_FALSE;
    if (rePractice.verification === 1 || origCertainty < 0.5) return T_UNKNOWN;
    return T_UNKNOWN;
  }

  private extractEmergentProperties(
    originalCognition: CognitionOutput,
    rePractice: RePracticeResult,
  ): string[] {
    const props: string[] = [];
    if (rePractice.newContradictions.length > 0) {
      props.push('再实践中涌现出新矛盾对');
    }
    if (rePractice.verification === 1 && originalCognition.principles.length >= 2) {
      props.push('规律在再实践中展现出稳定性——这是螺旋上升的标志');
    }
    return props;
  }

  private updateConfidence(current: Tryte, verification: Trit): Tryte {
    const evidence: Tryte = [verification, 0, 0, verification, 0, 0];
    return tryteMerge(current, evidence);
  }

  // ─── 质量评估 ───

  private evaluateQuality(
    practice: PracticeResult,
    cognition: CognitionOutput,
    rePractice: RePracticeResult,
    deepened: DeepenedCognition,
  ): {
    genuineAscension: Trit;
    newConfidence: Tryte;
    contradictionProgress: Trit;
  } {
    // 真正上升的条件：四阶段均非负面，且深化认识上升
    const allNonNegative =
      practice.verdict !== -1 &&
      cognition.universality !== -1 &&
      rePractice.verification !== -1;

    const genuineAscension: Trit = allNonNegative &&
      deepened.spiralAscension === 1
      ? T_TRUE
      : deepened.spiralAscension === -1
        ? T_FALSE
        : T_UNKNOWN;

    return {
      genuineAscension,
      newConfidence: deepened.updatedConfidenceVector,
      contradictionProgress: rePractice.newContradictions.length > 0
        ? T_TRUE
        : T_UNKNOWN,
    };
  }

  private assessPWImpact(
    deepened: DeepenedCognition,
    quality: { genuineAscension: Trit; newConfidence: Tryte; contradictionProgress: Trit },
  ): {
    phaseShift: Trit;
    newPhase?: 'defense' | 'stalemate' | 'counteroffensive';
  } {
    if (deepened.spiralAscension === 1 && quality.contradictionProgress === 1) {
      return { phaseShift: T_TRUE, newPhase: 'counteroffensive' };
    }
    if (deepened.spiralAscension === 1) {
      return { phaseShift: T_TRUE, newPhase: 'stalemate' };
    }
    if (deepened.spiralAscension === -1) {
      return { phaseShift: T_FALSE };
    }
    return { phaseShift: T_UNKNOWN };
  }
}
