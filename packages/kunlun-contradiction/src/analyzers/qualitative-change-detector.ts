/**
 * 4. 量变质变检测器 (Qualitative Change Detector)
 *
 * 检测矛盾是否接近质变临界点。
 * 核心算法：
 *   - 追踪矛盾状态历史中正反题力量的变化
 *   - 计算累计量变程度（与临界阈值的距离）
 *   - 识别可能的质变触发因素
 *   - 预估质变时间
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionHistory,
  QualitativeChangeAssessment,
  QualitativeTrigger,
} from '../types';

export interface QualitativeChangeDetector {
  detect(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): QualitativeChangeAssessment;
}

export function createQualitativeChangeDetector(
  sensitivity: number = 0.5
): QualitativeChangeDetector {
  return new QualitativeChangeDetectorImpl(sensitivity);
}

class QualitativeChangeDetectorImpl implements QualitativeChangeDetector {
  private sensitivity: number;

  constructor(sensitivity: number) {
    this.sensitivity = Math.max(0.1, Math.min(1, sensitivity));
  }

  detect(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): QualitativeChangeAssessment {
    // 历史不足时给出较低置信度的评估
    if (history.states.length < 2) {
      return this.insufficientHistoryResult(contradiction);
    }

    // 计算量变累积
    const states = history.states;
    const accumulation = this.calculateAccumulation(states);
    const threshold = this.determineThreshold(contradiction);

    // 判断是否接近临界点
    const approachingThreshold = this.judgeThresholdProximity(accumulation, threshold);

    // 识别触发因素
    const triggers = this.identifyTriggers(states, contradiction);

    // 预估质变时间
    const estimatedTime = this.estimateThresholdTime(states, accumulation, threshold);

    // 质变后的预期新质
    const expectedNewQuality = this.describeNewQuality(contradiction, states);

    return {
      contradictionId: contradiction.id,
      approachingThreshold,
      quantitativeAccumulation: Math.round(accumulation * 100) / 100,
      thresholdValue: Math.round(threshold * 100) / 100,
      estimatedThresholdAt: estimatedTime,
      triggers,
      expectedNewQuality,
    };
  }

  private insufficientHistoryResult(contradiction: ContradictionPair): QualitativeChangeAssessment {
    const thesisStrength = (contradiction.thesis.confidenceTrit + 1) / 2;
    const antithesisStrength = (contradiction.antithesis.confidenceTrit + 1) / 2;
    const diff = Math.abs(thesisStrength - antithesisStrength);

    return {
      contradictionId: contradiction.id,
      approachingThreshold: diff > 0.8 ? 0 : -1,
      quantitativeAccumulation: diff,
      thresholdValue: 0.8,
      estimatedThresholdAt: null,
      triggers: [],
      expectedNewQuality: '历史数据不足，无法预测质变方向',
    };
  }

  private calculateAccumulation(states: ContradictionHistory['states']): number {
    if (states.length < 2) return 0;

    let totalChange = 0;
    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1];
      const curr = states[i];
      // 计算正反题力量的变化量
      const thesisChange = Math.abs(curr.thesisStrength - prev.thesisStrength);
      const antithesisChange = Math.abs(curr.antithesisStrength - prev.antithesisStrength);
      totalChange += thesisChange + antithesisChange;

      // 主导方面变化加分
      if (curr.dominantAspect !== prev.dominantAspect) {
        totalChange += 0.3;
      }
    }

    // 归一化
    return Math.min(1, totalChange / (states.length * 2 * this.sensitivity));
  }

  private determineThreshold(contradiction: ContradictionPair): number {
    // 不同矛盾类型的质变阈值不同
    switch (contradiction.contradictionType) {
      case 'antagonistic':
        return 0.6; // 对抗性矛盾质变阈值较低
      case 'quantitative':
        return 0.5; // 量变型矛盾阈值最低
      case 'negation':
        return 0.7;
      case 'principal':
        return 0.75;
      default:
        return 0.7;
    }
  }

  private judgeThresholdProximity(accumulation: number, threshold: number): Trit {
    const ratio = accumulation / threshold;

    if (ratio >= 1.0) return 1;     // 已质变 / 超越临界点
    if (ratio >= 0.8) return 0;     // 接近临界点
    return -1;                       // 远未到临界点
  }

  private identifyTriggers(
    states: ContradictionHistory['states'],
    contradiction: ContradictionPair
  ): QualitativeTrigger[] {
    const triggers: QualitativeTrigger[] = [];

    if (states.length < 2) return triggers;

    const latest = states[states.length - 1];

    // 1. 主导方面变化触发
    if (states.length >= 3) {
      const prev = states[states.length - 2];
      if (prev.dominantAspect !== latest.dominantAspect) {
        triggers.push({
          description: '矛盾主导方面发生转换',
          probability: 0.8,
          impact: 1,
          controllable: false,
        });
      }
    }

    // 2. 力量失衡触发
    const imbalance = Math.abs(latest.thesisStrength - latest.antithesisStrength);
    if (imbalance > 0.6) {
      triggers.push({
        description: `正反题力量严重失衡（差距 ${(imbalance * 100).toFixed(0)}%）`,
        probability: 0.7,
        impact: 1,
        controllable: false,
      });
    }

    // 3. 对抗性矛盾有额外触发
    if (contradiction.contradictionType === 'antagonistic') {
      triggers.push({
        description: '对抗性矛盾的内在破裂倾向',
        probability: 0.6,
        impact: 1,
        controllable: false,
      });
    }

    // 4. 外部干预作为可控触发
    triggers.push({
      description: '有意识的外部干预或条件改变',
      probability: 0.4,
      impact: 0,
      controllable: true,
    });

    return triggers;
  }

  private estimateThresholdTime(
    states: ContradictionHistory['states'],
    currentAccumulation: number,
    threshold: number
  ): number | null {
    if (states.length < 3) return null;

    // 计算平均变化速率
    const recentStates = states.slice(-5);
    let totalDuration = 0;
    let totalChange = 0;

    for (let i = 1; i < recentStates.length; i++) {
      const duration = recentStates[i].timestamp - recentStates[i - 1].timestamp;
      const change = Math.abs(
        (recentStates[i].thesisStrength - recentStates[i - 1].thesisStrength)
      ) + Math.abs(
        (recentStates[i].antithesisStrength - recentStates[i - 1].antithesisStrength)
      );
      totalDuration += duration;
      totalChange += change;
    }

    if (totalChange === 0) return null;

    const changeRate = totalChange / Math.max(1, totalDuration);
    const remainingChange = Math.max(0, threshold - currentAccumulation);
    const estimatedMs = (remainingChange / changeRate) * 1000;

    // 限制预估范围
    if (estimatedMs > 365 * 24 * 3600 * 1000) return null; // 超过一年不预估

    return Date.now() + estimatedMs;
  }

  private describeNewQuality(
    contradiction: ContradictionPair,
    states: ContradictionHistory['states']
  ): string {
    if (states.length < 2) return '未知';

    const latest = states[states.length - 1];

    if (latest.dominantAspect === 1) {
      return `矛盾可能转化为以正题"${this.truncate(contradiction.thesis.statement)}"为主导的新质`;
    } else if (latest.dominantAspect === -1) {
      return `矛盾可能转化为以反题"${this.truncate(contradiction.antithesis.statement)}"为主导的新质`;
    }
    return '矛盾可能转化为新的平衡态或涌现全新的矛盾结构';
  }

  private truncate(text: string, maxLen: number = 30): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
}
