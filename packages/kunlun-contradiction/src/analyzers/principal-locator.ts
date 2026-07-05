/**
 * 1. 主要矛盾定位器 (Principal Contradiction Locator)
 *
 * 从多个矛盾中识别主要矛盾和矛盾的主要方面。
 * 核心算法：
 *   - 计算每个矛盾的"影响力"（影响范围 × 紧迫度 × 矛盾强度）
 *   - 排序后最高者为主要矛盾
 *   - 分析主要矛盾中哪个方面占主导
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  PrincipalContradictionResult,
} from '../types';

export interface PrincipalContradictionLocator {
  locate(contradictions: ContradictionPair[]): PrincipalContradictionResult;
}

export function createPrincipalContradictionLocator(): PrincipalContradictionLocator {
  return new PrincipalContradictionLocatorImpl();
}

class PrincipalContradictionLocatorImpl implements PrincipalContradictionLocator {
  locate(contradictions: ContradictionPair[]): PrincipalContradictionResult {
    if (contradictions.length === 0) {
      return {
        principalId: '',
        principalAspect: 0,
        secondaryContradictions: [],
        confidence: 0,
        reasoning: '无矛盾输入，无法定位主要矛盾',
      };
    }

    if (contradictions.length === 1) {
      const single = contradictions[0];
      const aspect = this.determineDominantAspect(single);
      return {
        principalId: single.id,
        principalAspect: aspect,
        secondaryContradictions: [],
        confidence: 0.9,
        reasoning: `仅有一个矛盾对，自动认定为主要矛盾。类型：${single.contradictionType}`,
      };
    }

    // 计算每个矛盾的影响力分数
    const scored = contradictions.map(c => ({
      contradiction: c,
      score: this.calculateInfluenceScore(c),
    }));

    scored.sort((a, b) => b.score - a.score);

    const principal = scored[0];
    const aspect = this.determineDominantAspect(principal.contradiction);

    // 计算次要矛盾及其从属关系
    const secondary = scored.slice(1).map((item, index) => ({
      id: item.contradiction.id,
      subordinationStrength: 1 - (item.score / principal.score),
      dominatedByPrincipal: item.score < principal.score * 0.7,
    }));

    // 置信度基于主要矛盾与次要矛盾的分数差距
    const gap = scored.length > 1
      ? principal.score - scored[1].score
      : principal.score;
    const confidence = Math.min(1, 0.5 + gap / principal.score);

    return {
      principalId: principal.contradiction.id,
      principalAspect: aspect,
      secondaryContradictions: secondary,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: this.generateReasoning(principal.contradiction, aspect, scored),
    };
  }

  /**
   * 计算矛盾的影响力分数
   *
   * 影响因素：
   *   1. 矛盾类型权重（主要矛盾 > 对抗性 > 非对抗性 > 次要矛盾）
   *   2. 矛盾优先级
   *   3. 正反题力量差异（差异越大越紧迫）
   *   4. 关联矛盾数量（关联越多影响范围越大）
   */
  private calculateInfluenceScore(c: ContradictionPair): number {
    const typeWeight = this.getTypeWeight(c.contradictionType);
    const priorityWeight = c.priority;
    const strengthDiff = Math.abs(
      this.getPropositionStrength(c.thesis) - this.getPropositionStrength(c.antithesis)
    );
    const rangeWeight = Math.min(1, c.relatedContradictions.length / 5);

    return (
      typeWeight * 0.3 +
      priorityWeight * 0.3 +
      strengthDiff * 0.2 +
      rangeWeight * 0.2
    );
  }

  private getTypeWeight(type: string): number {
    switch (type) {
      case 'principal': return 1.0;
      case 'antagonistic': return 0.9;
      case 'internal': return 0.8;
      case 'quantitative': return 0.7;
      case 'negation': return 0.6;
      case 'non_antagonistic': return 0.5;
      case 'external': return 0.4;
      case 'secondary': return 0.3;
      default: return 0.5;
    }
  }

  private getPropositionStrength(p: { confidenceTrit: Trit; evidence: Array<{ strength: Trit }> }): number {
    // 综合信度和证据强度计算命题力量
    const evidenceStrength = p.evidence.length > 0
      ? p.evidence.reduce((sum, e) => sum + e.strength, 0) / p.evidence.length
      : 0;
    return (p.confidenceTrit * 0.5 + evidenceStrength * 0.5 + 1) / 2; // 归一化到 0~1
  }

  private determineDominantAspect(c: ContradictionPair): Trit {
    const thesisStrength = this.getPropositionStrength(c.thesis);
    const antithesisStrength = this.getPropositionStrength(c.antithesis);
    const diff = thesisStrength - antithesisStrength;

    if (diff > 0.1) return 1;   // thesis 主导
    if (diff < -0.1) return -1;  // antithesis 主导
    return 0;                     // 均势
  }

  private generateReasoning(
    principal: ContradictionPair,
    aspect: Trit,
    scored: Array<{ contradiction: ContradictionPair; score: number }>
  ): string {
    const aspectStr = aspect === 1 ? '正题主导' : aspect === -1 ? '反题主导' : '双方均势';
    const typeStr = this.getTypeName(principal.contradictionType);

    return `主要矛盾为 "${principal.thesis.statement}" vs "${principal.antithesis.statement}"` +
      `（类型：${typeStr}，影响力：${scored[0].score.toFixed(3)}），` +
      `当前${aspectStr}。` +
      (scored.length > 1
        ? ` 次要矛盾共 ${scored.length - 1} 个。`
        : '');
  }

  private getTypeName(type: string): string {
    const names: Record<string, string> = {
      antagonistic: '对抗性矛盾',
      non_antagonistic: '非对抗性矛盾',
      principal: '主要矛盾',
      secondary: '次要矛盾',
      internal: '内部矛盾',
      external: '外部矛盾',
      quantitative: '量变质变矛盾',
      negation: '否定之否定矛盾',
    };
    return names[type] || type;
  }
}
