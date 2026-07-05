/**
 * 6. 矛盾转化预测器 (Contradiction Transformation Predictor)
 *
 * 预测矛盾对会如何转化为新的矛盾形式。
 * 核心算法：
 *   - 基于矛盾类型、力量对比、历史趋势预测转化方向
 *   - 计算多条转化路径的概率
 *   - 评估转化为对抗性矛盾的风险
 *   - 判断转化的必然性程度
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionHistory,
  TransformationPaths,
  TransformationPath,
} from '../types';

export interface TransformationPredictor {
  predict(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): TransformationPaths;
}

export function createTransformationPredictor(): TransformationPredictor {
  return new TransformationPredictorImpl();
}

class TransformationPredictorImpl implements TransformationPredictor {
  predict(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): TransformationPaths {
    // 计算基础指标
    const baseline = this.computeBaseline(contradiction, history);
    const paths = this.generatePaths(contradiction, history, baseline);

    // 按概率排序
    paths.sort((a, b) => b.probability - a.probability);

    // 判断转化必然性
    const inevitability = this.judgeInevitability(paths, baseline);

    return {
      contradictionId: contradiction.id,
      paths,
      inevitability,
      mostLikelyPathIndex: 0,
    };
  }

  private computeBaseline(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): {
    thesisStrength: number;
    antithesisStrength: number;
    dominant: Trit;
    trend: 'thesis_rising' | 'antithesis_rising' | 'stable' | 'both_declining';
    isAntagonistic: boolean;
    hasHistory: boolean;
    tensionLevel: number;
  } {
    const tConf = (contradiction.thesis.confidenceTrit + 1) / 2;
    const aConf = (contradiction.antithesis.confidenceTrit + 1) / 2;

    // 确定趋势
    let trend: 'thesis_rising' | 'antithesis_rising' | 'stable' | 'both_declining' = 'stable';
    if (history.states.length >= 3) {
      const recent = history.states.slice(-3);
      const tTrend = recent[2].thesisStrength - recent[0].thesisStrength;
      const aTrend = recent[2].antithesisStrength - recent[0].antithesisStrength;

      if (tTrend > 0.05 && aTrend < tTrend) {
        trend = 'thesis_rising';
      } else if (aTrend > 0.05 && tTrend < aTrend) {
        trend = 'antithesis_rising';
      } else if (tTrend < -0.05 && aTrend < -0.05) {
        trend = 'both_declining';
      }
    }

    const strengthDiff = Math.abs(tConf - aConf);
    const dominant = tConf > aConf + 0.1 ? 1 : aConf > tConf + 0.1 ? -1 : 0;

    return {
      thesisStrength: tConf,
      antithesisStrength: aConf,
      dominant,
      trend,
      isAntagonistic: contradiction.contradictionType === 'antagonistic',
      hasHistory: history.states.length >= 2,
      tensionLevel: Math.min(1, strengthDiff + contradiction.priority),
    };
  }

  private generatePaths(
    contradiction: ContradictionPair,
    history: ContradictionHistory,
    baseline: ReturnType<TransformationPredictorImpl['computeBaseline']>
  ): TransformationPath[] {
    const paths: TransformationPath[] = [];

    // ── 路径 1：正题主导统一（thesis absorbs/transcends） ──
    const thesisDominantProb = baseline.dominant === 1
      ? 0.7 + baseline.tensionLevel * 0.2
      : baseline.trend === 'thesis_rising'
        ? 0.5 + baseline.tensionLevel * 0.1
        : baseline.dominant === 0
          ? 0.3
          : 0.15;
    paths.push({
      description: baseline.isAntagonistic
        ? `正题通过超越反题实现统一：${this.truncate(contradiction.thesis.statement)}`
        : `正题吸收反题合理成分实现综合：${this.truncate(contradiction.thesis.statement)}`,
      resultingContradiction: null, // 矛盾消解，产生合题
      probability: Math.round(thesisDominantProb * 100) / 100,
      conditions: [
        '正题持续获得新证据支持',
        '反题的关键论据被证伪或吸收',
        '外部条件有利于正题发展',
      ],
      antagonisticRisk: baseline.isAntagonistic ? 0.5 : 0.1,
    });

    // ── 路径 2：反题主导统一 ──
    const antithesisDominantProb = baseline.dominant === -1
      ? 0.7 + baseline.tensionLevel * 0.2
      : baseline.trend === 'antithesis_rising'
        ? 0.5 + baseline.tensionLevel * 0.1
        : baseline.dominant === 0
          ? 0.3
          : 0.15;
    paths.push({
      description: baseline.isAntagonistic
        ? `反题通过颠覆正题实现变革：${this.truncate(contradiction.antithesis.statement)}`
        : `反题通过重构正题实现更新：${this.truncate(contradiction.antithesis.statement)}`,
      resultingContradiction: null,
      probability: Math.round(antithesisDominantProb * 100) / 100,
      conditions: [
        '反题获得突破性证据',
        '正题核心论证出现漏洞',
        '实践反馈支持反题方向',
      ],
      antagonisticRisk: baseline.isAntagonistic ? 0.6 : 0.15,
    });

    // ── 路径 3：高级综合（synthesis → 新矛盾） ──
    const synthesisProb = baseline.dominant === 0
      ? 0.5 + baseline.tensionLevel * 0.3
      : 0.2 + baseline.tensionLevel * 0.15;
    paths.push({
      description: `正反题通过高级综合形成新的矛盾层次：正题核心 + 反题洞见 → 更高维度的问题`,
      resultingContradiction: this.buildSynthesizedContradiction(contradiction),
      probability: Math.round(synthesisProb * 100) / 100,
      conditions: [
        '正反题存在共同的基础领域',
        '双方有可以融合的核心洞见',
        '外部压力推动综合解决',
      ],
      antagonisticRisk: 0.05,
    });

    // ── 路径 4：维持现状（僵持） ──
    const stalemateProb = baseline.trend === 'stable'
      ? 0.4
      : baseline.trend === 'both_declining'
        ? 0.35
        : 0.15;
    paths.push({
      description: '矛盾对维持当前僵持状态，短期内不转化',
      resultingContradiction: contradiction,
      probability: Math.round(stalemateProb * 100) / 100,
      conditions: [
        '双方力量保持动态平衡',
        '缺少外部触发因素',
        '矛盾各方缺乏改变动力',
      ],
      antagonisticRisk: baseline.isAntagonistic ? 0.3 : 0.05,
    });

    // ── 路径 5：转化为对抗性矛盾 ──
    if (!baseline.isAntagonistic) {
      const antagonisticProb = baseline.tensionLevel > 0.7
        ? 0.3
        : baseline.tensionLevel > 0.4
          ? 0.15
          : 0.05;
      paths.push({
        description: `非对抗性矛盾激化为对抗性矛盾：${this.truncate(contradiction.thesis.statement)} vs ${this.truncate(contradiction.antithesis.statement)}`,
        resultingContradiction: {
          ...contradiction,
          contradictionType: 'antagonistic',
          priority: Math.min(1, contradiction.priority + 0.3),
        },
        probability: Math.round(antagonisticProb * 100) / 100,
        conditions: [
          '沟通渠道断裂',
          '利益冲突加剧',
          '第三方势力介入激化',
        ],
        antagonisticRisk: 1.0,
      });
    }

    // ── 路径 6：矛盾消解（自然消亡） ──
    if (baseline.trend === 'both_declining') {
      paths.push({
        description: '矛盾双方力量同时衰减，矛盾自然消解',
        resultingContradiction: null,
        probability: 0.25,
        conditions: [
          '外部环境变化使矛盾失去意义',
          '双方同时失去支撑依据',
          '新问题的出现替代了原有矛盾',
        ],
        antagonisticRisk: 0,
      });
    }

    return paths;
  }

  private buildSynthesizedContradiction(
    original: ContradictionPair
  ): ContradictionPair {
    return {
      id: `${original.id}_synthesis`,
      thesis: {
        ...original.thesis,
        id: `${original.thesis.id}_syn`,
        statement: `综合：${original.thesis.statement}`,
        confidenceTrit: 0,
      },
      antithesis: {
        ...original.antithesis,
        id: `${original.antithesis.id}_syn`,
        statement: `综合对立面：${original.antithesis.statement}`,
        confidenceTrit: 0,
      },
      contradictionType: 'non_antagonistic',
      discoveredBy: 'self_reflection',
      discoveredAt: Date.now(),
      relatedContradictions: [original.id],
      priority: original.priority * 0.7,
      presenceStateAtDiscovery: original.presenceStateAtDiscovery,
      warPhaseAtDiscovery: original.warPhaseAtDiscovery,
    };
  }

  /**
   * 判断转化必然性
   *
   * +1: 必然转化 — 最可能路径概率 > 0.7 且与第二概率差 > 0.2
   *  0: 可能转化 — 多路径概率分散，方向不确定
   * -1: 大概率维持现状 — 维持现状路径概率最高
   */
  private judgeInevitability(
    paths: TransformationPath[],
    baseline: ReturnType<TransformationPredictorImpl['computeBaseline']>
  ): Trit {
    if (paths.length === 0) return 0;

    const best = paths[0];
    const secondBest = paths.length > 1 ? paths[1] : null;

    // 维持现状是第二条路径（索引 3）
    const stalemate = paths.find(p => p.description.includes('僵持'));

    if (stalemate && stalemate === best) {
      return -1; // 维持现状是最可能路径
    }

    if (best.probability >= 0.7 && (!secondBest || best.probability - secondBest.probability > 0.2)) {
      return 1; // 某条路径明显占优
    }

    // 连续下降趋势也暗示转化必然性
    if (baseline.trend === 'both_declining') {
      return 1;
    }

    return 0; // 多路径概率分散，不确定
  }

  private truncate(text: string, maxLen: number = 40): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
}
