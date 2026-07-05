/**
 * ContradictionEngine — 矛盾分析引擎主引擎
 *
 * 集成 8 个分析器，提供综合性的矛盾分析管线。
 *
 * 管线流程：
 *   1. 输入验证与预处理
 *   2. 主要矛盾定位（如果输入多个矛盾对）
 *   3. 逐对分析：
 *      a. 矛盾方面分析
 *      b. 对立统一推导
 *      c. 量变质变检测
 *      d. 否定之否定检测
 *      e. 矛盾转化预测
 *      f. 统一条件推导
 *   4. 矛盾链分析（多矛盾场景）
 *   5. 综合输出组装
 */

import type { Trit, Tryte } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionHistory,
  ContradictionAnalysisOutput,
  ContradictionEngineConfig,
} from './types';
import { DEFAULT_CONTRADICTION_ENGINE_CONFIG } from './types';

// 分析器
import {
  createPrincipalContradictionLocator,
  type PrincipalContradictionLocator,
} from './analyzers/principal-locator';
import {
  createAspectAnalyzer,
  type AspectAnalyzer,
} from './analyzers/aspect-analyzer';
import {
  createUnityDeriver,
  type UnityDeriver,
} from './analyzers/unity-deriver';
import {
  createQualitativeChangeDetector,
  type QualitativeChangeDetector,
} from './analyzers/qualitative-change-detector';
import {
  createNegationDetector,
  type NegationDetector,
} from './analyzers/negation-detector';
import {
  createTransformationPredictor,
  type TransformationPredictor,
} from './analyzers/transformation-predictor';
import {
  createUnificationConditionsDeriver,
  type UnificationConditionsDeriver,
} from './analyzers/unification-conditions';
import {
  createContradictionChainAnalyzer,
  type ContradictionChainAnalyzer,
} from './analyzers/contradiction-chain';

export interface ContradictionEngine {
  /** 分析单个矛盾对 */
  analyzeSingle(
    contradiction: ContradictionPair,
    history?: ContradictionHistory
  ): ContradictionAnalysisOutput;

  /** 分析多个矛盾对 */
  analyzeMultiple(
    contradictions: ContradictionPair[],
    histories?: Map<string, ContradictionHistory>
  ): ContradictionAnalysisOutput[];

  /** 获取当前配置 */
  getConfig(): ContradictionEngineConfig;

  /** 更新配置 */
  updateConfig(partial: Partial<ContradictionEngineConfig>): void;
}

export function createContradictionEngine(
  config?: Partial<ContradictionEngineConfig>
): ContradictionEngine {
  return new ContradictionEngineImpl(config);
}

const ENGINE_VERSION = '2.0.0-phase1';

class ContradictionEngineImpl implements ContradictionEngine {
  private config: ContradictionEngineConfig;

  // 分析器实例
  private principalLocator: PrincipalContradictionLocator;
  private aspectAnalyzer: AspectAnalyzer;
  private unityDeriver: UnityDeriver;
  private qualitativeDetector: QualitativeChangeDetector;
  private negationDetector: NegationDetector;
  private transformationPredictor: TransformationPredictor;
  private unificationDeriver: UnificationConditionsDeriver;
  private chainAnalyzer: ContradictionChainAnalyzer;

  constructor(config?: Partial<ContradictionEngineConfig>) {
    this.config = { ...DEFAULT_CONTRADICTION_ENGINE_CONFIG, ...config };

    this.principalLocator = createPrincipalContradictionLocator();
    this.aspectAnalyzer = createAspectAnalyzer();
    this.unityDeriver = createUnityDeriver();
    this.qualitativeDetector = createQualitativeChangeDetector(
      this.config.qualitativeChangeSensitivity
    );
    this.negationDetector = createNegationDetector();
    this.transformationPredictor = createTransformationPredictor();
    this.unificationDeriver = createUnificationConditionsDeriver();
    this.chainAnalyzer = createContradictionChainAnalyzer();
  }

  getConfig(): ContradictionEngineConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<ContradictionEngineConfig>): void {
    this.config = { ...this.config, ...partial };
    this.qualitativeDetector = createQualitativeChangeDetector(
      this.config.qualitativeChangeSensitivity
    );
  }

  // ─── 单矛盾分析 ───

  analyzeSingle(
    contradiction: ContradictionPair,
    history?: ContradictionHistory
  ): ContradictionAnalysisOutput {
    const startTime = Date.now();
    const modulesExecuted: string[] = [];

    // 构造默认历史（如果未提供）
    const actualHistory = history || this.buildDefaultHistory(contradiction);

    // 1. 矛盾方面分析
    const aspect = this.runIfEnabled('aspectAnalyzer', () => {
      modulesExecuted.push('aspect-analyzer');
      return this.aspectAnalyzer.analyze(contradiction);
    });

    // 2. 对立统一推导
    const unity = this.runIfEnabled('unityDeriver', () => {
      modulesExecuted.push('unity-deriver');
      return this.unityDeriver.derive(
        contradiction.thesis.statement,
        contradiction.antithesis.statement,
        contradiction
      );
    });

    // 3. 量变质变检测
    const qualitative = this.runIfEnabled('qualitativeChangeDetector', () => {
      modulesExecuted.push('qualitative-change-detector');
      return this.qualitativeDetector.detect(contradiction, actualHistory);
    });

    // 4. 否定之否定检测
    const negation = this.runIfEnabled('negationDetector', () => {
      modulesExecuted.push('negation-detector');
      return this.negationDetector.detect(contradiction, actualHistory);
    });

    // 5. 矛盾转化预测
    const transformation = this.runIfEnabled('transformationPredictor', () => {
      modulesExecuted.push('transformation-predictor');
      return this.transformationPredictor.predict(contradiction, actualHistory);
    });

    // 6. 统一条件推导
    const unification = this.runIfEnabled('unificationConditionsDeriver', () => {
      modulesExecuted.push('unification-conditions-deriver');
      return this.unificationDeriver.derive(contradiction, actualHistory);
    });

    // 7. 综合判定
    const unifiability = this.synthesizeUnifiability(unity, negation);
    const dominantAspect = aspect
      ? aspect.overallBalance
      : this.computeDominantFromStrength(contradiction);

    // 8. 构建建议
    const recommendations = this.buildRecommendations(
      contradiction, aspect, unity, qualitative, negation, transformation
    );

    // 9. 置信度计算
    const confidence = this.computeOverallConfidence(
      aspect, unity, qualitative, negation, transformation
    );

    const duration = Date.now() - startTime;

    return {
      contradictionId: contradiction.id,
      analysis: {
        unifiability,
        unificationPaths: unity?.paths || [],
        dominantAspect,
        contradictionType: contradiction.contradictionType,
      },
      qualitativeChange: {
        approachingThreshold: qualitative?.approachingThreshold ?? 0,
        estimatedThresholdAt: qualitative?.estimatedThresholdAt ?? null,
        triggers: qualitative?.triggers ?? [],
        quantitativeAccumulation: qualitative?.quantitativeAccumulation ?? 0,
      },
      negationCycle: {
        stage: negation?.stage ?? -1,
        emergentProperties: negation?.emergentProperties ?? [],
        isGenuineAscension: negation?.isSpiralAscension ?? false,
      },
      transformationPrediction: {
        inevitability: transformation?.inevitability ?? 0,
        mostLikelyPath: transformation
          ? (transformation.paths[transformation.mostLikelyPathIndex]?.description ?? '未知')
          : '未知',
        antagonisticRisk: transformation
          ? (transformation.paths[transformation.mostLikelyPathIndex]?.antagonisticRisk ?? 0)
          : 0,
      },
      recommendations,
      overallConfidence: confidence.trit,
      confidenceVector: confidence.vector,
      metadata: {
        analyzedAt: Date.now(),
        analysisDurationMs: duration,
        modulesExecuted,
        engineVersion: ENGINE_VERSION,
      },
    };
  }

  // ─── 多矛盾分析 ───

  analyzeMultiple(
    contradictions: ContradictionPair[],
    histories?: Map<string, ContradictionHistory>
  ): ContradictionAnalysisOutput[] {
    if (contradictions.length === 0) return [];

    const results: ContradictionAnalysisOutput[] = [];

    // 依优先级降序分析
    const sorted = [...contradictions].sort((a, b) => b.priority - a.priority);

    for (const c of sorted) {
      const hist = histories?.get(c.id);
      results.push(this.analyzeSingle(c, hist));
    }

    return results;
  }

  // ─── 辅助方法 ───

  private runIfEnabled<T>(analyzerKey: string, fn: () => T): T | null {
    if (!this.config.enableAllAnalyzers) {
      const enabled = this.config.enabledAnalyzers;
      // 将驼峰名转换为可能的配置名
      const matcher = analyzerKey.replace(/([A-Z])/g, '-$1').toLowerCase();
      if (!enabled.some(e => e.toLowerCase() === matcher || e === analyzerKey)) {
        return null;
      }
    }
    return fn();
  }

  private buildDefaultHistory(contradiction: ContradictionPair): ContradictionHistory {
    const tStr = (contradiction.thesis.confidenceTrit + 1) / 2;
    const aStr = (contradiction.antithesis.confidenceTrit + 1) / 2;
    const dominant = tStr > aStr + 0.1 ? 1 : aStr > tStr + 0.1 ? -1 : 0;

    return {
      contradictionId: contradiction.id,
      states: [{
        timestamp: Date.now() - 3600_000, // 1小时前
        thesisStrength: tStr,
        antithesisStrength: aStr,
        dominantAspect: dominant,
        phase: contradiction.warPhaseAtDiscovery,
        note: '引擎自动生成的默认历史状态',
      }],
      interventions: [],
      createdAt: Date.now() - 3600_000,
      updatedAt: Date.now(),
    };
  }

  /**
   * 综合多个分析器的结论计算最终的可统一性判定
   */
  private synthesizeUnifiability(
    unity: ReturnType<UnityDeriver['derive']> | null,
    negation: ReturnType<NegationDetector['detect']> | null
  ): Trit {
    if (!unity) {
      // 如果没有统一推导器结果，从否定之否定推断
      if (negation?.stage === 1 && negation.isSpiralAscension) return 0;
      return 0;
    }

    // 基础：对立统一推导器的结果
    const base = unity.unifiability;

    // 否定之否定修正
    if (negation) {
      if (negation.stage === 1 && negation.isSpiralAscension) {
        // 螺旋上升 → 提升可统一性（但不能超过 +1）
        return base === 1 ? 1 : (base === 0 ? 1 : 0);
      }
      if (negation.stage === 0 && !negation.isSpiralAscension) {
        // 简单否定阶段 → 可统一性降级
        return base === 1 ? 0 : base;
      }
    }

    return base;
  }

  private computeDominantFromStrength(contradiction: ContradictionPair): Trit {
    const t = (contradiction.thesis.confidenceTrit + 1) / 2;
    const a = (contradiction.antithesis.confidenceTrit + 1) / 2;
    if (t > a + 0.1) return 1;
    if (a > t + 0.1) return -1;
    return 0;
  }

  private buildRecommendations(
    contradiction: ContradictionPair,
    aspect: ReturnType<AspectAnalyzer['analyze']> | null,
    unity: ReturnType<UnityDeriver['derive']> | null,
    qualitative: ReturnType<QualitativeChangeDetector['detect']> | null,
    negation: ReturnType<NegationDetector['detect']> | null,
    transformation: ReturnType<TransformationPredictor['predict']> | null
  ): ContradictionAnalysisOutput['recommendations'] {
    const recs: ContradictionAnalysisOutput['recommendations'] = [];

    // 1. 基于统一路径的建议
    if (unity && unity.paths.length > 0) {
      const bestPath = unity.paths[unity.bestPathIndex];
      recs.push({
        action: `推进统一路径：${bestPath.description}`,
        priority: 1,
        expectedOutcome: bestPath.expectedOutcome,
        confidence: unity.confidence,
        preconditions: bestPath.preconditions,
      });
    }

    // 2. 基于质变检测的建议
    if (qualitative) {
      if (qualitative.approachingThreshold === 0) {
        recs.push({
          action: '矛盾接近质变临界点，建议主动引导质变方向或采取预防措施',
          priority: 1,
          expectedOutcome: qualitative.expectedNewQuality,
          confidence: qualitative.quantitativeAccumulation,
          preconditions: qualitative.triggers
            .filter(t => t.controllable)
            .map(t => t.description),
        });
      } else if (qualitative.approachingThreshold === 1) {
        recs.push({
          action: '矛盾已发生质变，建议评估新质并调整策略',
          priority: 0,
          expectedOutcome: `适应新质：${qualitative.expectedNewQuality}`,
          confidence: 0.8,
          preconditions: [],
        });
      }
    }

    // 3. 基于否定之否定的建议
    if (negation && negation.isSpiralAscension) {
      recs.push({
        action: `矛盾处于螺旋上升阶段，可利用涌现的新属性：${negation.emergentProperties.slice(0, 2).join('、')}`,
        priority: 0,
        expectedOutcome: '加速螺旋上升进程，缩短否定之否定周期',
        confidence: negation.ascensionStrength,
        preconditions: [],
      });
    }

    // 4. 基于转化预测的建议
    if (transformation && transformation.paths.length > 0) {
      const mostLikely = transformation.paths[transformation.mostLikelyPathIndex];
      if (mostLikely.antagonisticRisk > 0.5) {
        recs.push({
          action: `警告：最可能的转化路径存在对抗性风险（${(mostLikely.antagonisticRisk * 100).toFixed(0)}%），建议引导至低风险路径`,
          priority: 1,
          expectedOutcome: '降低对抗性转化风险',
          confidence: mostLikely.probability,
          preconditions: mostLikely.conditions,
        });
      }
    }

    // 5. 基于方面的建议
    if (aspect) {
      const weakSide = aspect.overallBalance === 1
        ? '反题'
        : aspect.overallBalance === -1
          ? '正题'
          : null;
      if (weakSide) {
        recs.push({
          action: `${weakSide}处于劣势，建议补充证据或重新审视其论证逻辑`,
          priority: -1,
          expectedOutcome: `${weakSide}力量增强，促进矛盾健康演化`,
          confidence: 0.6,
          preconditions: [],
        });
      }
    }

    return recs;
  }

  private computeOverallConfidence(
    aspect: ReturnType<AspectAnalyzer['analyze']> | null,
    unity: ReturnType<UnityDeriver['derive']> | null,
    qualitative: ReturnType<QualitativeChangeDetector['detect']> | null,
    negation: ReturnType<NegationDetector['detect']> | null,
    transformation: ReturnType<TransformationPredictor['predict']> | null
  ): { trit: Trit; vector: Tryte } {
    // 收集各分析器的置信度
    const confidences: number[] = [];

    if (aspect) confidences.push(
      (aspect.thesis.internalConsistency + aspect.antithesis.internalConsistency) / 2
    );
    if (unity) confidences.push(unity.confidence);
    if (qualitative) confidences.push(qualitative.quantitativeAccumulation);
    if (negation) confidences.push(negation.ascensionStrength);
    if (transformation) {
      const topPath = transformation.paths[transformation.mostLikelyPathIndex];
      if (topPath) confidences.push(topPath.probability);
    }

    if (confidences.length === 0) {
      return { trit: 0, vector: [0, 0, 0, 0, 0, 0] };
    }

    const avgConfidence = confidences.reduce((s, c) => s + c, 0) / confidences.length;

    // 转为 Trit
    let trit: Trit;
    if (avgConfidence >= 0.7) trit = 1;
    else if (avgConfidence >= 0.4) trit = 0;
    else trit = -1;

    // 六维信度向量
    const vector: Tryte = [
      aspect ? ((aspect.thesis.internalConsistency + aspect.antithesis.internalConsistency) / 2 >= 0.7 ? 1 : (aspect.thesis.internalConsistency + aspect.antithesis.internalConsistency) / 2 >= 0.4 ? 0 : -1) : 0,
      unity?.confidence ?? 0,
      typeof qualitative?.expectedNewQuality === 'string' && qualitative.expectedNewQuality !== '未知' ? 1 : 0,
      negation?.isSpiralAscension ? 1 : 0,
      transformation ? (transformation.inevitability === 1 ? 1 : 0) : 0,
      trit,
    ];

    return { trit, vector };
  }
}
