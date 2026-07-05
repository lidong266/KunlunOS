/**
 * 5. 否定之否定检测器 (Negation of Negation Detector)
 *
 * 检测矛盾是否经历否定之否定——螺旋上升的过程。
 * 核心算法：
 *   - 从历史状态识别三次否定：肯定 → 第一次否定 → 否定之否定
 *   - 区分真正螺旋上升与简单来回（循环）
 *   - 识别涌现的新属性、被保留的旧属性、被抛弃的旧属性
 *   - 计算螺旋上升力度（精华保留率 × 新质涌现率）
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  ContradictionHistory,
  NegationAssessment,
} from '../types';

export interface NegationDetector {
  detect(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): NegationAssessment;
}

export function createNegationDetector(): NegationDetector {
  return new NegationDetectorImpl();
}

class NegationDetectorImpl implements NegationDetector {
  detect(
    contradiction: ContradictionPair,
    history: ContradictionHistory
  ): NegationAssessment {
    const states = history.states;

    if (states.length < 3) {
      return this.insufficientDataResult(contradiction);
    }

    // 阶段识别：通过主导方面的变化识别否定阶段
    const phases = this.identifyPhases(states);
    const stage = this.determineStage(phases, states);

    // 螺旋上升 vs 简单循环判别
    const { isSpiral, ascensionStrength } = this.judgeAscensionType(
      phases, states, contradiction
    );

    // 属性分析
    const emergent = this.extractEmergentProperties(states, contradiction);
    const preserved = this.extractPreservedProperties(states, contradiction);
    const discarded = this.extractDiscardedProperties(states, contradiction);

    const cycleCount = Math.floor(phases.length / 2);

    return {
      contradictionId: contradiction.id,
      stage,
      isSpiralAscension: isSpiral,
      emergentProperties: emergent,
      preservedProperties: preserved,
      discardedProperties: discarded,
      ascensionStrength: Math.round(ascensionStrength * 100) / 100,
      cycleCount,
    };
  }

  /**
   * 识别否定阶段：检测主导方面的交替
   *
   * 三次否定：
   *   肯定(A主导) → 第一次否定(B主导) → 否定之否定(A'主导)
   *   关键在于 A' ≠ A 纯粹返回，而是新质的涌现
   */
  private identifyPhases(
    states: ContradictionHistory['states']
  ): Array<{
    startIdx: number;
    endIdx: number;
    dominant: Trit;
    avgThesisStrength: number;
    avgAntithesisStrength: number;
  }> {
    if (states.length === 0) return [];

    const phases: Array<{
      startIdx: number;
      endIdx: number;
      dominant: Trit;
      avgThesisStrength: number;
      avgAntithesisStrength: number;
    }> = [];

    let currentDominant = states[0].dominantAspect;
    let phaseStart = 0;

    for (let i = 1; i < states.length; i++) {
      if (states[i].dominantAspect !== currentDominant && states[i].dominantAspect !== 0) {
        // 主导方面发生变化，结束当前阶段
        const phaseStates = states.slice(phaseStart, i);
        phases.push({
          startIdx: phaseStart,
          endIdx: i - 1,
          dominant: currentDominant,
          avgThesisStrength: this.avg(phaseStates.map(s => s.thesisStrength)),
          avgAntithesisStrength: this.avg(phaseStates.map(s => s.antithesisStrength)),
        });
        currentDominant = states[i].dominantAspect;
        phaseStart = i;
      }
    }

    // 最后一个阶段
    const lastPhaseStates = states.slice(phaseStart);
    phases.push({
      startIdx: phaseStart,
      endIdx: states.length - 1,
      dominant: currentDominant,
      avgThesisStrength: this.avg(lastPhaseStates.map(s => s.thesisStrength)),
      avgAntithesisStrength: this.avg(lastPhaseStates.map(s => s.antithesisStrength)),
    });

    return phases;
  }

  /**
   * 判定当前所处阶段
   *   +1: 否定之否定（螺旋上升）—— 回到原主导方面但有新质
   *    0: 第一次否定阶段
   *   -1: 原状态（肯定阶段）
   */
  private determineStage(
    phases: Array<{
      dominant: Trit;
      avgThesisStrength: number;
      avgAntithesisStrength: number;
    }>,
    states: ContradictionHistory['states']
  ): Trit {
    if (phases.length < 2) return -1;

    const firstDominant = phases[0].dominant;
    const lastDominant = phases[phases.length - 1].dominant;

    // 如果经历了至少一次否定再回到初始主导
    if (phases.length >= 3 && lastDominant === firstDominant && lastDominant !== 0) {
      // 检查新阶段与最初阶段是否有实质差异（螺旋上升的标志）
      const firstPhase = phases[0];
      const lastPhase = phases[phases.length - 1];

      const thesisDiff = Math.abs(lastPhase.avgThesisStrength - firstPhase.avgThesisStrength);
      const antithesisDiff = Math.abs(lastPhase.avgAntithesisStrength - firstPhase.avgAntithesisStrength);

      if (thesisDiff > 0.1 || antithesisDiff > 0.1) {
        return 1; // 否定之否定，有实质变化
      }
      return 0; // 回到原点但不是螺旋上升
    }

    if (lastDominant !== firstDominant && lastDominant !== 0) {
      return 0; // 处于第一次否定阶段
    }

    return -1; // 原状态
  }

  /**
   * 判断是真正的螺旋上升还是简单循环
   *
   * 螺旋上升的判别标准：
   *   1. 每个否定阶段的平均力量强度递增
   *   2. 主导方的信度提升
   *   3. 证据集的充实度增加
   */
  private judgeAscensionType(
    phases: Array<{
      dominant: Trit;
      avgThesisStrength: number;
      avgAntithesisStrength: number;
    }>,
    states: ContradictionHistory['states'],
    contradiction: ContradictionPair
  ): { isSpiral: boolean; ascensionStrength: number } {
    if (phases.length < 3) {
      return { isSpiral: false, ascensionStrength: 0 };
    }

    // 指标 1：相同主导方面的阶段，平均力量强度是否递增
    let strengthProgression = 0;
    const sameDominantPhases = phases
      .map((p, i) => ({ phase: p, index: i }))
      .filter(({ phase }) => phase.dominant !== 0);

    for (let i = 1; i < sameDominantPhases.length; i++) {
      const prev = sameDominantPhases[i - 1].phase;
      const curr = sameDominantPhases[i].phase;
      const prevTotal = prev.avgThesisStrength + prev.avgAntithesisStrength;
      const currTotal = curr.avgThesisStrength + curr.avgAntithesisStrength;
      if (currTotal > prevTotal) {
        strengthProgression += 1;
      }
    }

    // 指标 2：整体趋势——最新状态的正反题力量之和是否高于初始
    const firstState = states[0];
    const lastState = states[states.length - 1];
    const firstTotal = firstState.thesisStrength + firstState.antithesisStrength;
    const lastTotal = lastState.thesisStrength + lastState.antithesisStrength;
    const totalImprovement = lastTotal > firstTotal + 0.05;

    // 指标 3：最终主导方的回位是否伴随新质
    const firstDominant = phases[0].dominant;
    const lastDominant = phases[phases.length - 1].dominant;
    const returnedWithEnhancement =
      lastDominant === firstDominant &&
      phases.length >= 3 &&
      phases[phases.length - 1].avgThesisStrength > phases[0].avgThesisStrength + 0.05;

    // 综合判断
    const phasePairCount = Math.floor(sameDominantPhases.length / 2);
    const strengthScore = phasePairCount > 0
      ? Math.min(1, strengthProgression / phasePairCount)
      : 0;

    const isSpiral =
      (returnedWithEnhancement || totalImprovement) &&
      strengthScore > 0.3;

    // 螺旋上升力度 = 力量递增度 × 0.5 + 总体提升幅度 × 0.3 + 回位增强 × 0.2
    const ascensionStrength =
      strengthScore * 0.5 +
      (totalImprovement ? 0.3 : 0) +
      (returnedWithEnhancement ? 0.2 : 0);

    return {
      isSpiral,
      ascensionStrength: Math.min(1, ascensionStrength),
    };
  }

  /**
   * 提取涌现的新属性
   *
   * 新属性源自：
   *   - 否定阶段引入的新证据类型
   *   - 历史中首次出现的变化模式
   *   - 矛盾对本身的类型转化特征
   */
  private extractEmergentProperties(
    states: ContradictionHistory['states'],
    contradiction: ContradictionPair
  ): string[] {
    const emergent: string[] = [];
    const firstThesisStr = states[0].thesisStrength;
    const lastThesisStr = states[states.length - 1].thesisStrength;
    const firstAntiStr = states[0].antithesisStrength;
    const lastAntiStr = states[states.length - 1].antithesisStrength;

    // 力量变化检测
    if (Math.abs(lastThesisStr - firstThesisStr) > 0.15) {
      emergent.push(
        lastThesisStr > firstThesisStr
          ? '正题力量显著增强，涌现出更强的论证能力'
          : '正题力量显著减弱，可能演化出新形式'
      );
    }

    if (Math.abs(lastAntiStr - firstAntiStr) > 0.15) {
      emergent.push(
        lastAntiStr > firstAntiStr
          ? '反题力量显著增强，涌现出新的对立维度'
          : '反题力量显著减弱，可能被部分吸收'
      );
    }

    // 主导方面变化
    if (states[states.length - 1].dominantAspect !== states[0].dominantAspect) {
      emergent.push(
        `主导方面从${this.aspectLabel(states[0].dominantAspect)}转变为${this.aspectLabel(states[states.length - 1].dominantAspect)}`
      );
    }

    // 矛盾类型相关的涌现
    if (contradiction.contradictionType === 'negation') {
      emergent.push('否定之否定过程中涌现出高级综合形态');
    }

    if (contradiction.contradictionType === 'quantitative') {
      emergent.push('量变累积过程中涌现新的质的规定性');
    }

    // 多次主导方面交替则涌现合成元素
    if (this.countDominantSwitches(states) >= 2) {
      emergent.push('多次否定交替中涌现出综合性的新认识');
    }

    return emergent.length > 0 ? emergent : ['数据不足，无法识别涌现属性'];
  }

  /**
   * 提取被保留的旧属性（扬弃中的"保留"）
   */
  private extractPreservedProperties(
    states: ContradictionHistory['states'],
    contradiction: ContradictionPair
  ): string[] {
    const preserved: string[] = [];

    // 始终稳定的特质视为被保留
    if (states.length >= 2) {
      const thesisStable = this.isStable(states.map(s => s.thesisStrength));
      const antithesisStable = this.isStable(states.map(s => s.antithesisStrength));

      if (thesisStable) {
        preserved.push('正题核心论证结构被保留');
      }

      if (antithesisStable) {
        preserved.push('反题核心批判维度被保留');
      }

      // 领域上下文保留
      preserved.push(`领域上下文 "${contradiction.thesis.domain}" 被保留`);

      // 矛盾关系网络保留
      if (contradiction.relatedContradictions.length > 0) {
        preserved.push('矛盾的关系网络结构被保留');
      }
    }

    return preserved.length > 0 ? preserved : ['核心矛盾结构框架被保留'];
  }

  /**
   * 提取被抛弃的旧属性（扬弃中的"抛弃"）
   */
  private extractDiscardedProperties(
    states: ContradictionHistory['states'],
    contradiction: ContradictionPair
  ): string[] {
    const discarded: string[] = [];

    if (states.length < 2) return ['数据不足'];

    const first = states[0];
    const last = states[states.length - 1];

    // 主导方面发生不可逆转变
    if (first.dominantAspect !== 0 && last.dominantAspect !== 0 &&
        first.dominantAspect !== last.dominantAspect) {
      discarded.push(
        `原有的${this.aspectLabel(first.dominantAspect)}主导地位被抛弃`
      );
    }

    // 力量显著下降的一方被部分抛弃
    if (last.thesisStrength < first.thesisStrength - 0.2) {
      discarded.push('正题的部分论据被实践否定而抛弃');
    }

    if (last.antithesisStrength < first.antithesisStrength - 0.2) {
      discarded.push('反题的部分批判被证伪而抛弃');
    }

    // 对抗性矛盾中旧的对立形式被抛弃
    if (contradiction.contradictionType === 'antagonistic') {
      discarded.push('对抗性的激进形式被抛弃（向非对抗转化或更高形式消解）');
    }

    return discarded.length > 0 ? discarded : ['暂时无明显被抛弃的属性'];
  }

  /** 计算数据序列的稳定性（标准差 < 0.1 视为稳定） */
  private isStable(values: number[]): boolean {
    if (values.length < 2) return true;
    const mean = this.avg(values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) < 0.1;
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private countDominantSwitches(states: ContradictionHistory['states']): number {
    let switches = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i].dominantAspect !== states[i - 1].dominantAspect) {
        switches++;
      }
    }
    return switches;
  }

  private aspectLabel(aspect: Trit): string {
    if (aspect === 1) return '正题';
    if (aspect === -1) return '反题';
    return '均势';
  }

  private insufficientDataResult(contradiction: ContradictionPair): NegationAssessment {
    return {
      contradictionId: contradiction.id,
      stage: -1,
      isSpiralAscension: false,
      emergentProperties: ['历史状态不足（需 ≥ 3 条记录），无法检测否定之否定过程'],
      preservedProperties: [],
      discardedProperties: [],
      ascensionStrength: 0,
      cycleCount: 0,
    };
  }
}
